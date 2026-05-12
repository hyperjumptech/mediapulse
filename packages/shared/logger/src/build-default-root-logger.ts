import pino from "pino";
import pinoPretty from "pino-pretty";

import { isLogPrettyEnabled } from "./is-log-pretty-enabled.js";

const buildBaseOptions = (
  processEnv: NodeJS.ProcessEnv,
): pino.LoggerOptions => ({
  level: processEnv.LOG_LEVEL ?? "info",
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      'res.headers["set-cookie"]',
      "err.options.headers.authorization",
      "err.config.headers.Authorization",
      "*.headers.authorization",
      "*.headers.Authorization",
      '*.headers["x-api-key"]',
      "password",
      "*.password",
      "token",
      "*.token",
      "apiKey",
      "*.apiKey",
      "secret",
      "*.secret",
      "email",
      "*.email",
    ],
    censor: "[REDACTED]",
  },
});

export type BuildDefaultRootLoggerDeps = {
  /**
   * When pretty logging is enabled, supplies the destination stream (tests use e.g. `PassThrough`).
   * Production omits this and uses the default pino-pretty stream.
   */
  createPrettyDestination?: () => import("node:stream").Writable;
};

/**
 * Builds the shared root Pino logger: JSON lines by default, or pino-pretty when `LOG_PRETTY` is enabled.
 *
 * @param processEnv - Environment map (defaults to `process.env` when omitted at call site).
 * @param deps - Optional DI for tests (pretty destination).
 * @returns Configured Pino logger instance.
 */
export const buildDefaultRootLogger = (
  processEnv: NodeJS.ProcessEnv = process.env,
  deps: BuildDefaultRootLoggerDeps = {},
): pino.Logger => {
  const baseOptions = buildBaseOptions(processEnv);
  if (!isLogPrettyEnabled(processEnv)) {
    return pino(baseOptions);
  }
  const destination =
    deps.createPrettyDestination?.() ??
    pinoPretty({
      colorize: true,
      translateTime: "SYS:standard",
      singleLine: false,
    });
  return pino(baseOptions, destination);
};
