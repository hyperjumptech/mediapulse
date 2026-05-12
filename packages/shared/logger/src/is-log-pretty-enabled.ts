/**
 * Returns whether `LOG_PRETTY` requests human-readable Pino output (pino-pretty).
 *
 * @param processEnv - Typically `process.env`; injectable for tests.
 * @returns True when `LOG_PRETTY` is `1`, `true`, or `TRUE`.
 */
export const isLogPrettyEnabled = (processEnv: NodeJS.ProcessEnv): boolean => {
  const raw = processEnv.LOG_PRETTY;
  return raw === "1" || raw === "true" || raw === "TRUE";
};
