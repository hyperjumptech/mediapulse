import { maskSecretsInJson } from "@/lib/json-secret-mask";

/** Default cap for stored request body UTF-8 bytes (256 KiB). */
export const DEFAULT_HTTP_TRIGGER_REQUEST_BODY_MAX_BYTES = 256 * 1024;

/** Placeholder stored instead of raw credential header values. */
export const HTTP_TRIGGER_REQUEST_HEADER_REDACTED = "[REDACTED]";

const SENSITIVE_HEADER_NAMES = new Set(
  [
    "authorization",
    "cookie",
    "set-cookie",
    "proxy-authorization",
    "x-api-key",
    "x-auth-token",
  ].map((h) => h.toLowerCase()),
);

/**
 * Header names whose values must not be persisted on HTTP trigger executions.
 *
 * @param name - Raw header name from the incoming request.
 */
export const isSensitiveHttpHeaderName = (name: string): boolean =>
  SENSITIVE_HEADER_NAMES.has(name.trim().toLowerCase());

/**
 * Builds a plain record of URL query parameters. Duplicate keys become string arrays;
 * single values stay strings (JSDoc: last duplicate alone would lose data, so we use arrays when repeated).
 *
 * @param searchParams - `URLSearchParams` from the request URL.
 */
export const searchParamsToRecord = (
  searchParams: URLSearchParams,
): Record<string, string | string[]> => {
  const out: Record<string, string | string[]> = {};
  for (const key of searchParams.keys()) {
    const all = searchParams.getAll(key);
    out[key] = all.length <= 1 ? (all[0] ?? "") : all;
  }
  return out;
};

/**
 * Returns true when the Content-Type indicates we should not load the full body into memory as text
 * (binary or multipart payloads).
 *
 * @param contentType - Raw `Content-Type` header value, may include charset etc.
 */
export const shouldOmitBodyForContentType = (
  contentType: string | null,
): boolean => {
  if (contentType == null || contentType === "") return false;
  const primary = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
  if (primary.startsWith("multipart/")) return true;
  if (primary === "application/octet-stream") return true;
  if (primary.startsWith("image/")) return true;
  if (primary.startsWith("video/")) return true;
  if (primary.startsWith("audio/")) return true;
  return false;
};

type TruncateUtf8Result = {
  text: string;
  truncated: boolean;
  originalByteLength: number;
};

/**
 * Truncates a string to a maximum UTF-8 byte length without splitting a codepoint.
 *
 * @param input - Full body text.
 * @param maxBytes - Maximum UTF-8 bytes to keep.
 */
export const truncateUtf8String = (
  input: string,
  maxBytes: number,
): TruncateUtf8Result => {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const full = encoder.encode(input);
  const originalByteLength = full.length;
  if (full.length <= maxBytes) {
    return { text: input, truncated: false, originalByteLength };
  }
  let end = Math.min(maxBytes, full.length);
  const fatalDecoder = new TextDecoder("utf-8", { fatal: true });
  while (end > 0) {
    try {
      fatalDecoder.decode(full.slice(0, end));
      break;
    } catch {
      end -= 1;
    }
  }
  return {
    text: decoder.decode(full.slice(0, end)),
    truncated: true,
    originalByteLength,
  };
};

/**
 * Collects all header names and values, redacting known credential headers.
 *
 * @param headers - The incoming `Request` headers.
 */
export const collectRedactedHeaderRecord = (
  headers: Headers,
): Record<string, string> => {
  const out: Record<string, string> = {};
  headers.forEach((value, name) => {
    const key = name.toLowerCase();
    out[key] = isSensitiveHttpHeaderName(name)
      ? HTTP_TRIGGER_REQUEST_HEADER_REDACTED
      : value;
  });
  return out;
};

/** Version 1 snapshot stored on `HttpTriggerExecution.metadata`. */
export type HttpTriggerRequestSnapshotV1 = {
  requestSnapshotVersion: 1;
  request: {
    method: string;
    url: string;
    pathname: string;
    searchParams: Record<string, string | string[]>;
  };
  headers: Record<string, string>;
  body: {
    contentType: string | null;
    originalByteLength?: number;
    truncated?: boolean;
    text?: string;
    json?: unknown;
    parseError?: string;
    omittedReason?: string;
  };
  client: {
    userAgent: string | null;
    forwardedFor: string | null;
    realIp: string | null;
    cfConnectingIp: string | null;
  };
};

export type CollectHttpTriggerRequestSnapshotOptions = {
  /** Maximum UTF-8 bytes to store from the body; defaults to {@link DEFAULT_HTTP_TRIGGER_REQUEST_BODY_MAX_BYTES}. */
  maxBodyBytes?: number;
};

/**
 * Reads the request body and builds the `body` field of the snapshot (omit, text, or JSON).
 *
 * @param request - Incoming HTTP request.
 * @param contentType - Normalized primary content type or null.
 * @param maxBodyBytes - Max UTF-8 bytes to persist.
 */
export const buildRequestBodySnapshot = async (
  request: Request,
  contentType: string | null,
  maxBodyBytes: number,
): Promise<HttpTriggerRequestSnapshotV1["body"]> => {
  if (shouldOmitBodyForContentType(contentType)) {
    return {
      contentType,
      omittedReason: "non_text_or_large_binary_content_type",
    };
  }

  let rawText: string;
  try {
    rawText = await request.text();
  } catch {
    return {
      contentType,
      omittedReason: "body_read_failed",
    };
  }

  const { text, truncated, originalByteLength } = truncateUtf8String(
    rawText,
    maxBodyBytes,
  );

  const primaryType = contentType?.split(";")[0]?.trim().toLowerCase() ?? "";

  if (primaryType === "application/json" || primaryType.endsWith("+json")) {
    if (text === "") {
      return {
        contentType,
        originalByteLength: 0,
        truncated: false,
        text: "",
      };
    }
    try {
      const parsed = JSON.parse(text) as unknown;
      return {
        contentType,
        originalByteLength,
        truncated,
        text: truncated ? text : undefined,
        json: maskSecretsInJson(parsed),
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : "invalid_json";
      return {
        contentType,
        originalByteLength,
        truncated,
        text,
        parseError: message,
      };
    }
  }

  return {
    contentType,
    originalByteLength,
    truncated,
    text: text === "" ? "" : text,
  };
};

/**
 * Captures URL, headers (redacted), optional body, and common client headers for persistence on an HTTP trigger execution.
 *
 * @param request - The invoke `Request` after auth has succeeded (body is only read once).
 * @param options - Optional `maxBodyBytes` override for tests or policy.
 */
export const collectHttpTriggerRequestSnapshot = async (
  request: Request,
  options: CollectHttpTriggerRequestSnapshotOptions = {},
): Promise<HttpTriggerRequestSnapshotV1> => {
  const maxBodyBytes =
    options.maxBodyBytes ?? DEFAULT_HTTP_TRIGGER_REQUEST_BODY_MAX_BYTES;
  const url = new URL(request.url);
  const contentType = request.headers.get("content-type");

  const headers = collectRedactedHeaderRecord(request.headers);

  const body = await buildRequestBodySnapshot(
    request,
    contentType,
    maxBodyBytes,
  );

  return {
    requestSnapshotVersion: 1,
    request: {
      method: request.method,
      url: request.url,
      pathname: url.pathname,
      searchParams: searchParamsToRecord(url.searchParams),
    },
    headers,
    body,
    client: {
      userAgent: request.headers.get("user-agent"),
      forwardedFor: request.headers.get("x-forwarded-for"),
      realIp: request.headers.get("x-real-ip"),
      cfConnectingIp: request.headers.get("cf-connecting-ip"),
    },
  };
};

/**
 * Wraps a version-1 request snapshot as `HttpTriggerExecution.metadata` JSON.
 *
 * @param snapshot - Snapshot from {@link collectHttpTriggerRequestSnapshot}.
 */
export const toHttpTriggerExecutionMetadata = (
  snapshot: HttpTriggerRequestSnapshotV1,
): Record<string, unknown> => ({
  requestSnapshotVersion: snapshot.requestSnapshotVersion,
  request: snapshot.request,
  headers: snapshot.headers,
  body: snapshot.body,
  client: snapshot.client,
});
