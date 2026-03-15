import pino from "pino";
import { trace, context } from "@opentelemetry/api";
import { env } from "@workspace/env";

const baseOptions: pino.LoggerOptions = {
  level: env.LOG_LEVEL,
  mixin() {
    const span = trace.getSpan(context.active());
    if (!span) return {};
    const spanContext = span.spanContext();
    return {
      trace_id: spanContext.traceId,
      span_id: spanContext.spanId,
      trace_flags: spanContext.traceFlags.toString(16).padStart(2, "0"),
    };
  },
  redact: {
    paths: [
      // HTTP Headers
      "req.headers.authorization",
      "req.headers.cookie",
      'res.headers["set-cookie"]',
      // Catch headers inside error objects (e.g., got/axios errors)
      "err.options.headers.authorization",
      "err.config.headers.Authorization",
      "*.headers.authorization",
      "*.headers.Authorization",
      '*.headers["x-api-key"]',
      // Common secret keys
      "password",
      "*.password",
      "token",
      "*.token",
      "apiKey",
      "*.apiKey",
      "secret",
      "*.secret",
      // PII
      "email",
      "*.email",
    ],
    censor: "[REDACTED]",
  },
};

/**
 * Standardized logger for the workspace.
 * Automatically injects OpenTelemetry trace context if available.
 */
export const logger = pino(baseOptions);

export { pino };
export type { Logger } from "pino";
