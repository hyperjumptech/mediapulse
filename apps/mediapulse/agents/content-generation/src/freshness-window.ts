/**
 * Computes the calendar-day boundaries for the skip-if-fresh precheck.
 *
 * Freshness window formula:
 *   windowStart = start of the current calendar day in `timezone` (IANA), expressed as UTC.
 *   windowEnd   = start of the next calendar day in `timezone`, expressed as UTC.
 *
 * The interval is half-open: [windowStart, windowEnd).
 *
 * **Deliberate divergence from source-selection (v1):**
 * The data-source selection window in `getDataSourcesForTicker` uses UTC start-of-day
 * (`scoredAt >= startOfTodayUtc`). This skip-if-fresh window uses the configured IANA
 * timezone instead. These windows are intentionally different in v1:
 *   - Source selection is a broader query that benefits from UTC simplicity.
 *   - The freshness check must reflect "today" as perceived by the end user (in
 *     `config.freshness.timezone`), so that a newsletter generated at 11 PM Jakarta
 *     time is considered "today's" newsletter even though it falls in the previous UTC day.
 * Aligning these windows is deferred to a later phase.
 *
 * **Delivery-agent coordination:**
 * When the content-generation step is skipped (`skipped_fresh_newsletter_exists`), no
 * new newsletter row is written. The delivery agent must be designed to either:
 *   (a) locate and deliver the existing newsletter row for today, or
 *   (b) skip its own delivery step when no new row appears.
 * This contract is not enforced here; it is documented for downstream consumers.
 */

/**
 * Returns the UTC start and end timestamps for the current calendar day
 * in the given IANA timezone.
 *
 * @param timezone - IANA timezone string (e.g. "Asia/Jakarta").
 * @param now - Current date/time (injectable for testing).
 * @returns An object with `windowStart` and `windowEnd` as ISO 8601 strings.
 */
export function computeFreshnessWindow(
  timezone: string,
  now: Date = new Date(),
): { windowStart: string; windowEnd: string } {
  // Format the current time in the target timezone to extract date parts
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  const get = (type: string) => {
    const part = parts.find((p) => p.type === type);
    return part?.value ?? "";
  };

  const year = parseInt(get("year"), 10);
  const month = parseInt(get("month"), 10);
  const day = parseInt(get("day"), 10);

  // Compute the offset between the UTC time and the local time in the timezone
  // by creating a Date from the local parts and comparing it to the original `now`.
  const localMidnightUTC = Date.UTC(year, month - 1, day, 0, 0, 0, 0);

  // Determine the timezone offset by comparing the formatted local time to UTC
  const localTimeAsUTC = Date.UTC(
    year,
    month - 1,
    day,
    parseInt(get("hour"), 10),
    parseInt(get("minute"), 10),
    parseInt(get("second"), 10),
  );

  const offsetMs = localTimeAsUTC - now.getTime();

  // The actual start-of-day in UTC for the calendar day in the timezone
  const startMs = localMidnightUTC - offsetMs;
  const endMs = startMs + 24 * 60 * 60 * 1000;

  return {
    windowStart: new Date(startMs).toISOString(),
    windowEnd: new Date(endMs).toISOString(),
  };
}
