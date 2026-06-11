export { formatMsDuration } from "./format-pipeline-timeout-preview";

/**
 * Returns true when the given unit string represents milliseconds.
 *
 * @param unit - Unit string from a KPI or widget (may be undefined).
 * @returns True when `unit === "ms"`.
 */
export function isDurationUnit(unit?: string): boolean {
  return unit === "ms";
}

/**
 * Formats a millisecond duration as a compact human-readable string.
 *
 * - Sub-second: `"850 ms"` (or `"0 ms"` for zero)
 * - Seconds: `"5.2s"` (one decimal when < 10 s), `"23s"` (whole seconds)
 * - Minutes: `"2m 30s"`, dropping `"0s"` (e.g. `"5m"`)
 * - Hours: `"1h 5m"`, dropping `"0m"` (e.g. `"1h"`)
 * - Negative: leading `"−"` with the same magnitude rules
 *
 * @param ms - Duration in milliseconds (may be negative).
 * @returns Compact label.
 */
export function formatCompactDuration(ms: number): string {
  if (ms === 0) return "0 ms";

  const isNegative = ms < 0;
  const abs = Math.abs(ms);
  const prefix = isNegative ? "−" : "";

  if (abs < 1000) {
    return `${prefix}${abs} ms`;
  }

  if (abs < 60_000) {
    const seconds = abs / 1000;
    const formatted =
      seconds < 10
        ? String(Math.round(seconds * 10) / 10).replace(/\.0$/, "")
        : String(Math.round(seconds));

    return `${prefix}${formatted}s`;
  }

  if (abs < 3_600_000) {
    const totalSeconds = Math.round(abs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const parts = [`${minutes}m`];
    if (seconds > 0) parts.push(`${seconds}s`);

    return `${prefix}${parts.join(" ")}`;
  }

  const totalMinutes = Math.round(abs / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const parts = [`${hours}h`];
  if (minutes > 0) parts.push(`${minutes}m`);

  return `${prefix}${parts.join(" ")}`;
}
