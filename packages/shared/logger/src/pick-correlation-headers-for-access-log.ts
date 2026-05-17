/**
 * Lowercase names for Hermes / pipeline correlation headers included in slim access logs.
 */
export const HERMES_ACCESS_LOG_CORRELATION_HEADER_NAMES = [
  "x-job-id",
  "x-execution-id",
  "x-pipeline-step-id",
  "x-schedule-id",
  "x-schedule-execution-id",
  "x-manual-execution-id",
] as const;

/**
 * Picks correlation headers from a request header map using case-insensitive names.
 * Omits empty or missing values. Output keys use the canonical lowercase names above.
 *
 * @param headers - Header map from `c.req.header()` or similar (keys may be any casing).
 * @returns Subset map suitable for structured access logs.
 */
export const pickHermesCorrelationHeadersForAccessLog = (
  headers: Record<string, string | undefined>,
): Record<string, string> => {
  const lowerKeyToValue: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined || value === "") {
      continue;
    }
    lowerKeyToValue[key.toLowerCase()] = value;
  }

  const picked: Record<string, string> = {};
  for (const name of HERMES_ACCESS_LOG_CORRELATION_HEADER_NAMES) {
    const value = lowerKeyToValue[name];
    if (value !== undefined) {
      picked[name] = value;
    }
  }
  return picked;
};
