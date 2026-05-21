import type { Context, MiddlewareHandler } from "hono";
import { pinoLogger } from "hono-pino";
import type { Options as HonoPinoOptions } from "hono-pino";

import { slimHonoPinoHttpLoggerOptions } from "./hono-pino-slim-http";
import { shouldSkipHttpAccessLog } from "./should-skip-http-access-log";

/** Root logger accepted by hono-pino (same as {@link pinoLogger} `pino` option). */
export type SlimPinoRootLogger = NonNullable<HonoPinoOptions["pino"]>;

/** Options for {@link slimPinoLogger}. */
export type SlimPinoLoggerOptions = {
  /** Root Pino logger instance. Defaults to the package default when omitted at call sites. */
  pino?: SlimPinoRootLogger;
  /** Hono context key for the logger. @default "logger" */
  contextKey?: "logger";
};

/**
 * Hono middleware: slim Pino access logs with `GET /health` completion logs suppressed.
 *
 * @param options - Logger instance and optional context key.
 * @returns Middleware that injects `c.var.logger` and logs request completion except for health checks.
 */
export const slimPinoLogger = (
  options: SlimPinoLoggerOptions = {},
): MiddlewareHandler => {
  const withAccessLog = pinoLogger({
    pino: options.pino,
    contextKey: options.contextKey,
    http: slimHonoPinoHttpLoggerOptions,
  });
  const withoutAccessLog = pinoLogger({
    pino: options.pino,
    contextKey: options.contextKey,
    http: false,
  });

  return async (c: Context, next) => {
    if (shouldSkipHttpAccessLog(c)) {
      return withoutAccessLog(c, next);
    }
    return withAccessLog(c, next);
  };
};
