import pino from "pino";

const isDev = process.env.NODE_ENV !== "production";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
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
  ...(isDev && {
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "SYS:standard",
        ignore: "pid,hostname",
      },
    },
  }),
});

export { pino };
export type { Logger } from "pino";
