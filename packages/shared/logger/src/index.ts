import pino from "pino";

import { buildDefaultRootLogger } from "./build-default-root-logger.js";

export const logger = buildDefaultRootLogger();

export { slimHonoPinoHttpLoggerOptions } from "./hono-pino-slim-http.js";
export { isLogPrettyEnabled } from "./is-log-pretty-enabled.js";
export {
  HERMES_ACCESS_LOG_CORRELATION_HEADER_NAMES,
  pickHermesCorrelationHeadersForAccessLog,
} from "./pick-correlation-headers-for-access-log.js";
export { buildDefaultRootLogger } from "./build-default-root-logger.js";
export type { BuildDefaultRootLoggerDeps } from "./build-default-root-logger.js";

export { pino };
export type { Logger } from "pino";
