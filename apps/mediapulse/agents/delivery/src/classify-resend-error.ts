/** Taxonomy for Resend / transport failures (retry policy). */
export type ResendErrorKind = "rate_limited" | "transient" | "non_retryable";

/** Subset of Resend SDK `ErrorResponse` used for classification without importing `resend` types here. */
export type ResendApiErrorShape = {
  message: string;
  statusCode: number | null;
  name: string;
};

/**
 * Type guard for a Resend API error object attached to thrown errors from {@link sendWithResendRetry}.
 *
 * @param v - Unknown value.
 */
export function isResendApiErrorShape(v: unknown): v is ResendApiErrorShape {
  return (
    typeof v === "object" &&
    v !== null &&
    "message" in v &&
    typeof (v as { message: unknown }).message === "string" &&
    "name" in v &&
    typeof (v as { name: unknown }).name === "string"
  );
}

/**
 * Classifies a Resend `emails.send` error payload (SDK `error` field).
 *
 * @param error - Resend error object from API response.
 */
export function classifyResendApiError(
  error: ResendApiErrorShape,
): ResendErrorKind {
  if (error.name === "rate_limit_exceeded" || error.statusCode === 429) {
    return "rate_limited";
  }
  if (
    error.name === "internal_server_error" ||
    error.name === "application_error" ||
    error.statusCode === 503 ||
    error.statusCode === 502 ||
    error.statusCode === 500
  ) {
    return "transient";
  }
  return "non_retryable";
}

/**
 * Parses `Retry-After` from response headers (seconds → milliseconds).
 *
 * @param headers - Normalized header map from Resend client response.
 */
export function retryAfterMsFromHeaders(
  headers: Record<string, string> | null | undefined,
): number | undefined {
  if (headers === null || headers === undefined) {
    return undefined;
  }
  const raw =
    headers["retry-after"] ?? headers["Retry-After"] ?? headers["RETRY-AFTER"];
  if (raw === undefined || raw === "") {
    return undefined;
  }
  const sec = Number(String(raw).trim());
  if (Number.isFinite(sec) && sec >= 0) {
    return sec * 1000;
  }
  return undefined;
}

const RESEND_ERR = "resendError" as const;
const RESEND_HDR = "resendHeaders" as const;

/**
 * Reads Resend error + headers attached by {@link sendWithResendRetry} on failure.
 *
 * @param err - Caught rejection.
 */
export function extractResendResponseParts(err: unknown): {
  api?: ResendApiErrorShape;
  headers?: Record<string, string> | null;
} {
  if (typeof err !== "object" || err === null) {
    return {};
  }
  const o = err as Record<string, unknown>;
  const api = o[RESEND_ERR];
  if (!isResendApiErrorShape(api)) {
    return {};
  }
  const headers = o[RESEND_HDR];
  return {
    api,
    headers:
      headers !== null &&
      headers !== undefined &&
      typeof headers === "object" &&
      !Array.isArray(headers)
        ? (headers as Record<string, string>)
        : null,
  };
}

/**
 * Maps a Resend client error (or thrown value) to a retry policy bucket.
 *
 * @param err - Error object or unknown rejection from `resend.emails.send`.
 */
export function classifyResendError(err: unknown): ResendErrorKind {
  const { api } = extractResendResponseParts(err);
  if (api !== undefined) {
    return classifyResendApiError(api);
  }
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();
  if (
    lower.includes("429") ||
    lower.includes("rate limit") ||
    lower.includes("too many requests")
  ) {
    return "rate_limited";
  }
  if (
    lower.includes("fetch failed") ||
    lower.includes("network") ||
    lower.includes("econnreset") ||
    lower.includes("timeout") ||
    lower.includes("503") ||
    lower.includes("502") ||
    lower.includes("500")
  ) {
    return "transient";
  }
  return "non_retryable";
}

/**
 * Parses `Retry-After` style delay from an error message if present (milliseconds).
 *
 * @param err - Error or unknown.
 */
export function retryAfterMsFromError(err: unknown): number | undefined {
  const { headers } = extractResendResponseParts(err);
  const fromHdr = retryAfterMsFromHeaders(headers ?? undefined);
  if (fromHdr !== undefined) {
    return fromHdr;
  }
  const msg = err instanceof Error ? err.message : String(err);
  const m = /retry[_-]?after[:\s]+(\d+)/i.exec(msg);
  if (m?.[1]) {
    const sec = Number(m[1]);
    if (Number.isFinite(sec) && sec > 0) {
      return sec * 1000;
    }
  }
  return undefined;
}
