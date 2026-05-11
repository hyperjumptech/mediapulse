/** Hermes default per-agent invoke timeout when pipeline `timeout` is null (5 minutes). */
export const DEFAULT_PIPELINE_TIMEOUT_MS = 300_000;

const nf = new Intl.NumberFormat("en-US");

/**
 * Builds a short accessibility-friendly sentence for the pipeline agent-timeout field from the raw input string.
 *
 * @param raw - Value from the timeout `<input>` (may be empty, partial digits, or invalid).
 * @returns Human-readable preview for empty, invalid, or valid positive millisecond values.
 */
export function formatPipelineTimeoutPreview(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed === "") {
    return `Uses Hermes default: ${formatMsDuration(DEFAULT_PIPELINE_TIMEOUT_MS)} (${nf.format(DEFAULT_PIPELINE_TIMEOUT_MS)} ms) per agent HTTP call.`;
  }
  if (!/^\d+$/.test(trimmed)) {
    return "Enter a positive whole number of milliseconds (digits only).";
  }
  const ms = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(ms) || ms <= 0) {
    return "Enter a positive whole number of milliseconds.";
  }
  return `Request timeout: ${formatMsDuration(ms)} (${nf.format(ms)} ms) per agent HTTP call.`;
}

/**
 * Formats a duration in milliseconds as a compact English phrase (hours, minutes, seconds as needed).
 *
 * @param ms - Positive duration in milliseconds.
 * @returns Phrase such as "5 minutes" or "1 hour 2 minutes 3 seconds".
 */
export function formatMsDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts: string[] = [];
  if (hours > 0) {
    parts.push(`${hours} ${hours === 1 ? "hour" : "hours"}`);
  }
  if (minutes > 0) {
    parts.push(`${minutes} ${minutes === 1 ? "minute" : "minutes"}`);
  }
  if (seconds > 0) {
    parts.push(`${seconds} ${seconds === 1 ? "second" : "seconds"}`);
  }
  if (parts.length === 0) {
    parts.push("0 seconds");
  }
  return parts.join(" ");
}
