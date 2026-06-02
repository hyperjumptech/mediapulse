/** Matches `YYYY-MM-DD` date-only query values from HTML date inputs. */
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type CreatedDateBound = "start" | "end";

/**
 * Parses a list filter date query value into a `Date` for `createdAt` bounds.
 *
 * - `YYYY-MM-DD` with bound `start` → start of UTC day.
 * - `YYYY-MM-DD` with bound `end` → end of UTC day (inclusive upper bound).
 * - Full ISO timestamps pass through unchanged.
 *
 * @param raw - Raw query string (may be undefined or empty).
 * @param bound - Whether this value is the lower (`from`) or upper (`to`) bound.
 * @returns Parsed date, or `undefined` when missing or invalid.
 */
export const parseCreatedDateBound = (
  raw: string | undefined,
  bound: CreatedDateBound,
): Date | undefined => {
  if (raw === undefined || raw.trim() === "") {
    return undefined;
  }
  const trimmed = raw.trim();
  if (DATE_ONLY_PATTERN.test(trimmed)) {
    if (bound === "start") {
      return new Date(`${trimmed}T00:00:00.000Z`);
    }
    return new Date(`${trimmed}T23:59:59.999Z`);
  }
  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? undefined : date;
};
