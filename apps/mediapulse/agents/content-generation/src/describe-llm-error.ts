import { APICallError, NoObjectGeneratedError, TypeValidationError } from "ai";

/** Longest response body kept on a diagnostic record. */
const MAX_RESPONSE_BODY_LENGTH = 600;

/** Longest error message kept on a diagnostic record. */
const MAX_MESSAGE_LENGTH = 400;

/**
 * Secret shapes that can appear in a provider error message or echoed request body.
 *
 * Mirrors the pattern in {@link ./sanitize-diagnostic-message.js} because both write to the same
 * diagnostic record and a key leaked through either one is equally exposed.
 */
const SECRET_PATTERN =
  /sk-[A-Za-z0-9]+|apiKey[^\s]*|api_key[^\s]*|Bearer\s+\S+|token=[^\s&]*/gi;

/** Provider error fields worth keeping when a run fails at the LLM stage. */
export type LlmErrorDetails = {
  kind: string;
  message: string;
  statusCode?: number;
  isRetryable?: boolean;
  url?: string;
  requestId?: string;
  responseBody?: string;
};

const redact = (value: string, limit: number): string => {
  const truncated =
    value.length > limit ? `${value.slice(0, limit)}...` : value;

  return truncated.replace(SECRET_PATTERN, "[REDACTED]");
};

const readHeader = (
  headers: Record<string, string> | undefined,
  name: string,
): string | undefined => {
  if (headers === undefined) {
    return undefined;
  }
  const match = Object.entries(headers).find(
    ([key]) => key.toLowerCase() === name,
  );

  return match?.[1];
};

const kindOf = (error: unknown): string => {
  if (error instanceof TypeValidationError) {
    return "TypeValidationError";
  }
  if (error instanceof NoObjectGeneratedError) {
    return "NoObjectGeneratedError";
  }
  if (error instanceof APICallError) {
    return "APICallError";
  }

  return error instanceof Error ? error.name : typeof error;
};

/**
 * Extracts the provider fields needed to diagnose an LLM failure after the fact.
 *
 * Without this the diagnostic record carries only `openai_non_retryable`, which says a call failed
 * and nothing about why. Every string is truncated and scanned for secrets, because the result is
 * persisted.
 *
 * @param error - Value thrown by the retry-wrapped generate call.
 * @returns Safe, structured fields describing the failure.
 */
export const describeLlmError = (error: unknown): LlmErrorDetails => {
  const details: LlmErrorDetails = {
    kind: kindOf(error),
    message: redact(
      error instanceof Error ? error.message : String(error),
      MAX_MESSAGE_LENGTH,
    ),
  };

  if (error instanceof APICallError) {
    details.isRetryable = error.isRetryable;
    details.url = error.url;
    if (typeof error.statusCode === "number") {
      details.statusCode = error.statusCode;
    }
    const requestId =
      readHeader(error.responseHeaders, "x-request-id") ??
      readHeader(error.responseHeaders, "request-id");
    if (requestId !== undefined) {
      details.requestId = requestId;
    }
    if (
      typeof error.responseBody === "string" &&
      error.responseBody.length > 0
    ) {
      details.responseBody = redact(
        error.responseBody,
        MAX_RESPONSE_BODY_LENGTH,
      );
    }
  }

  return details;
};
