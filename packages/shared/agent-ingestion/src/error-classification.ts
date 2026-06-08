import { HTTPError, TimeoutError, RequestError } from "got";
import { z } from "zod";
import type { DataCollectionFailure } from "@workspace/agent-data-api-contract";

/** Result of classifying an error for data-collection failure records. */
export type ClassifiedError = {
  category: DataCollectionFailure["errorCategory"];
  message: string;
  httpStatus?: number;
};

/**
 * Returns whether an error should be retried (rate limits, server errors, timeouts,
 * transient network failures).
 *
 * @param e - The thrown value from the HTTP client or parser.
 * @returns True when the caller may retry the same operation.
 */
export function isRetryableError(e: unknown): boolean {
  if (e instanceof HTTPError) {
    const status = e.response.statusCode;
    return status === 429 || status >= 500;
  }
  if (e instanceof TimeoutError) {
    return true;
  }
  if (e instanceof RequestError) {
    return [
      "ETIMEDOUT",
      "ECONNRESET",
      "EADDRINUSE",
      "ECONNREFUSED",
      "EPIPE",
      "ENOTFOUND",
      "ENETUNREACH",
      "EAI_AGAIN",
    ].includes(e.code ?? "");
  }
  return false;
}

/**
 * Maps thrown values to a stable failure category and message for API persistence.
 *
 * @param e - The thrown value from validation, HTTP, or internal code.
 * @returns Category, message, and optional HTTP status for the failure record.
 */
export function classifyError(e: unknown): ClassifiedError {
  if (e instanceof z.ZodError) {
    return { category: "provider_schema_error", message: e.message };
  }
  if (e instanceof HTTPError) {
    return {
      category: "provider_http_error",
      message: e.message,
      httpStatus: e.response.statusCode,
    };
  }
  if (e instanceof TimeoutError) {
    return { category: "timeout_error", message: e.message };
  }
  if (e instanceof RequestError) {
    return { category: "network_error", message: e.message };
  }
  if (e instanceof Error && e.message === "Semantic validation failed") {
    return {
      category: "provider_data_invalid",
      message: "Missing required fields in response",
    };
  }
  return {
    category: "internal_processing_error",
    message: e instanceof Error ? e.message : String(e),
  };
}
