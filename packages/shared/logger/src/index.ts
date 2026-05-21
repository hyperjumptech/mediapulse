// cursor-pr-review-disable: env-variables
import process from "node:process";
import pino from "pino";

import { buildDefaultRootLogger } from "./build-default-root-logger";

// eslint-disable-next-line strict-env/no-process-env -- Bootstrap only: @workspace/logger is imported before typed env in several runtimes; LOG_LEVEL / LOG_PRETTY are read here once.
export const logger = buildDefaultRootLogger(process.env);

export { slimHonoPinoHttpLoggerOptions } from "./hono-pino-slim-http";
export { slimPinoLogger } from "./slim-pino-logger";
export type { SlimPinoLoggerOptions } from "./slim-pino-logger";
export {
  normalizeHttpAccessLogPath,
  shouldSkipHttpAccessLog,
} from "./should-skip-http-access-log";
export { isLogPrettyEnabled } from "./is-log-pretty-enabled";
export {
  HERMES_ACCESS_LOG_CORRELATION_HEADER_NAMES,
  pickHermesCorrelationHeadersForAccessLog,
} from "./pick-correlation-headers-for-access-log";
export { buildDefaultRootLogger } from "./build-default-root-logger";
export type { BuildDefaultRootLoggerDeps } from "./build-default-root-logger";

export { pino };
export type { Logger } from "pino";
