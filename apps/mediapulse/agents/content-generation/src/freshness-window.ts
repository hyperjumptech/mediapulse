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
 * Normalizes `Intl.DateTimeFormat` wall-clock parts when the hour field is `24`.
 * Some engines emit `24:mm:ss` with non-zero minutes (invalid in ISO 8601); those
 * are treated as `00:mm:ss` on the same civil date. A valid end-of-day `24:00:00`
 * on civil date `D` is treated as `00:00:00` on the next civil day.
 *
 * @param year - Calendar year (e.g. 2026).
 * @param month - Calendar month (1–12).
 * @param day - Calendar day (1–31).
 * @param hour - Hour from formatter (may be 24).
 * @param minute - Minute (0–59).
 * @param second - Second (0–59).
 * @returns Normalized civil date/time fields.
 */
export const normalizeHour24WallClock = (
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} => {
  if (hour !== 24) {
    return { year, month, day, hour, minute, second };
  }
  if (minute === 0 && second === 0) {
    const shiftedMs = Date.UTC(year, month - 1, day + 1);
    const shifted = new Date(shiftedMs);
    return {
      year: shifted.getUTCFullYear(),
      month: shifted.getUTCMonth() + 1,
      day: shifted.getUTCDate(),
      hour: 0,
      minute: 0,
      second: 0,
    };
  }
  return { year, month, day, hour: 0, minute, second };
};

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

  const rawYear = parseInt(get("year"), 10);
  const rawMonth = parseInt(get("month"), 10);
  const rawDay = parseInt(get("day"), 10);
  const rawHour = parseInt(get("hour"), 10);
  const rawMinute = parseInt(get("minute"), 10);
  const rawSecond = parseInt(get("second"), 10);

  const { year, month, day, hour, minute, second } = normalizeHour24WallClock(
    rawYear,
    rawMonth,
    rawDay,
    rawHour,
    rawMinute,
    rawSecond,
  );

  // Compute the offset between the UTC time and the local time in the timezone
  // by creating a Date from the local parts and comparing it to the original `now`.
  const localMidnightUTC = Date.UTC(year, month - 1, day, 0, 0, 0, 0);

  // Determine the timezone offset by comparing the formatted local time to UTC
  const localTimeAsUTC = Date.UTC(year, month - 1, day, hour, minute, second);

  const offsetMs = localTimeAsUTC - now.getTime();

  // The actual start-of-day in UTC for the calendar day in the timezone
  const startMs = localMidnightUTC - offsetMs;
  const endMs = startMs + 24 * 60 * 60 * 1000;

  return {
    windowStart: new Date(startMs).toISOString(),
    windowEnd: new Date(endMs).toISOString(),
  };
}
