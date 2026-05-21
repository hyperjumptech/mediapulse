import type { Context } from "hono";

/**
 * Normalizes a request path for access-log skip checks by removing a trailing slash.
 *
 * @param path - Raw Hono request path.
 * @returns Path without a trailing slash (except root `/`).
 */
export const normalizeHttpAccessLogPath = (path: string): string =>
  path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;

/**
 * Returns whether hono-pino HTTP access logging should be skipped for this request.
 *
 * @param c - Hono request context.
 * @returns `true` for `GET /health` (and `GET /health/`).
 */
export const shouldSkipHttpAccessLog = (c: Context): boolean =>
  c.req.method === "GET" &&
  normalizeHttpAccessLogPath(c.req.path) === "/health";
