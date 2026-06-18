import type { Context } from "hono";
import { ZodError } from "zod";

/** Max chars of `error.message` exposed in the 500 response body. */
const MAX_DETAIL_LENGTH = 500;

/** Sensitive substrings stripped from exposed error details. */
const SENSITIVE_PATTERNS: ReadonlyArray<RegExp> = [
  /password=([^\s&"']+)/gi,
  /token=([^\s&"']+)/gi,
  /authorization:\s*bearer\s+[^\s"']+/gi,
];

/**
 * Strips known sensitive substrings and clamps the message length so the
 * response body stays safe to display in operator dashboards.
 *
 * @param message - Raw error message.
 * @returns Sanitized, length-bounded message.
 */
const sanitizeMessage = (message: string): string => {
  let cleaned = message;
  for (const pattern of SENSITIVE_PATTERNS) {
    cleaned = cleaned.replace(pattern, "[redacted]");
  }
  return cleaned.length > MAX_DETAIL_LENGTH
    ? `${cleaned.slice(0, MAX_DETAIL_LENGTH)}…`
    : cleaned;
};

/** Structured diagnostic block attached to 500 responses. */
export type InternalErrorDetail = {
  name: string;
  message: string;
  code?: string;
};

/**
 * Extracts a structured, sanitized diagnostic block from an unknown error.
 *
 * Captures `name`, `message`, and an optional `code` (e.g. Prisma `P2002`).
 * Stack traces are intentionally omitted to avoid leaking file system paths.
 *
 * @param error - Caught unknown.
 * @returns Sanitized detail block suitable for inclusion in 500 responses.
 */
export const buildInternalErrorDetail = (
  error: unknown,
): InternalErrorDetail => {
  if (error instanceof Error) {
    const code =
      "code" in error && typeof (error as { code: unknown }).code === "string"
        ? ((error as { code: string }).code as string)
        : undefined;
    return {
      name: error.name || "Error",
      message: sanitizeMessage(error.message || ""),
      ...(code ? { code } : {}),
    };
  }
  return {
    name: "Unknown",
    message: sanitizeMessage(String(error)),
  };
};

export function notFound(context: Context, message = "Not found"): Response {
  return context.json({ message }, 404);
}

/**
 * Returns a 500 response with a sanitized diagnostic block so operators can
 * tell what went wrong without crawling server logs. The legacy
 * `message: "Internal Server Error"` field is preserved for backwards
 * compatibility with retry classifiers.
 *
 * @param context - Hono request context.
 * @param error - Caught unknown from the route handler.
 */
export function internalError(context: Context, error: unknown): Response {
  if (error instanceof Response) {
    return error;
  }

  if (error instanceof ZodError) {
    return context.json({ message: "Bad Request", errors: error.issues }, 400);
  }

  const detail = buildInternalErrorDetail(error);
  console.error("API error:", detail, error);

  return context.json({ message: "Internal Server Error", error: detail }, 500);
}
