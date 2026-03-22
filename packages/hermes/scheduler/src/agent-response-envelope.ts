import { z } from "zod";

/** Successful or semantic-failure agent body per PRD §8.2 (after validation and truncation). */
export type ParsedAgentResponseEnvelope = {
  schemaVersion: 1;
  status: "success" | "failure";
  message?: string;
  details?: Record<string, unknown>;
  logs?: Array<{
    level: string;
    message: string;
    context?: Record<string, unknown>;
  }>;
  truncated: {
    message?: boolean;
    details?: boolean;
    logs?: boolean;
    logEntryMessages?: number[];
  };
};

const MAX_MESSAGE_CODE_POINTS = 2048;
const MAX_DETAILS_BYTES = 64 * 1024;
const MAX_LOGS_BYTES = 256 * 1024;
const MAX_LOG_ENTRIES = 400;
const MAX_LOG_MESSAGE_BYTES = 8 * 1024;

const baseEnvelopeSchema = z.object({
  schemaVersion: z.literal(1),
  status: z.enum(["success", "failure"]),
  message: z.string().optional(),
  details: z.record(z.string(), z.any()).optional(),
  logs: z
    .array(
      z.object({
        level: z.string(),
        message: z.string(),
        context: z.record(z.string(), z.any()).optional(),
      }),
    )
    .optional(),
});

/**
 * Returns the UTF-16 string length as an approximation of "code points" for ASCII-heavy logs;
 * for full Unicode, code point counting would differ; PRD allows a practical trim.
 */
const trimToCodePoints = (
  s: string,
  max: number,
): { text: string; truncated: boolean } => {
  if ([...s].length <= max) {
    return { text: s, truncated: false };
  }
  return { text: [...s].slice(0, max).join(""), truncated: true };
};

const utf8ByteLength = (value: unknown): number => {
  return new TextEncoder().encode(JSON.stringify(value)).length;
};

const truncateDetails = (
  details: Record<string, unknown> | undefined,
): { value: Record<string, unknown> | undefined; truncated: boolean } => {
  if (details === undefined) {
    return { value: undefined, truncated: false };
  }
  if (utf8ByteLength(details) <= MAX_DETAILS_BYTES) {
    return { value: details, truncated: false };
  }
  return {
    value: { _truncated: true, _reason: "details exceeded size limit" },
    truncated: true,
  };
};

const truncateLogs = (
  logs: ParsedAgentResponseEnvelope["logs"],
): {
  value: ParsedAgentResponseEnvelope["logs"];
  truncated: boolean;
  logEntryMessages: number[];
} => {
  if (!logs || logs.length === 0) {
    return { value: logs, truncated: false, logEntryMessages: [] };
  }
  const logEntryMessages: number[] = [];
  let out = [...logs].slice(0, MAX_LOG_ENTRIES);
  let truncated = logs.length > MAX_LOG_ENTRIES;
  out = out.map((entry, idx) => {
    const enc = new TextEncoder();
    if (enc.encode(entry.message).length <= MAX_LOG_MESSAGE_BYTES) {
      return entry;
    }
    logEntryMessages.push(idx);
    const bytes = enc.encode(entry.message);
    let cut = entry.message;
    while (bytes.length > MAX_LOG_MESSAGE_BYTES && cut.length > 0) {
      cut = cut.slice(0, -1);
    }
    return {
      ...entry,
      message: cut,
      context: { ...entry.context, _truncated: true },
    };
  });
  if (utf8ByteLength(out) > MAX_LOGS_BYTES) {
    truncated = true;
    out = [];
  }
  return { value: out, truncated, logEntryMessages };
};

export type ParseEnvelopeResult =
  | { ok: true; envelope: ParsedAgentResponseEnvelope }
  | { ok: false; error: { code: "invalid_json" | "schema"; message: string } };

/**
 * Parses and validates a 2xx response body. Empty body is treated as legacy success (PRD §7.4).
 *
 * @param rawBody - Raw response body string (may be empty).
 * @param isEmptyBody - True when there is no body bytes.
 */
export const parseAgentResponseEnvelope = (
  rawBody: string,
  isEmptyBody: boolean,
): ParseEnvelopeResult => {
  if (isEmptyBody || rawBody.trim() === "") {
    return {
      ok: true,
      envelope: {
        schemaVersion: 1,
        status: "success",
        truncated: {},
      },
    };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody) as unknown;
  } catch {
    return {
      ok: false,
      error: {
        code: "invalid_json",
        message: "Response body is not valid JSON",
      },
    };
  }
  const safe = baseEnvelopeSchema.safeParse(parsed);
  if (!safe.success) {
    return {
      ok: false,
      error: {
        code: "schema",
        message: safe.error.message,
      },
    };
  }
  const data = safe.data;
  const msgTrim = data.message
    ? trimToCodePoints(data.message, MAX_MESSAGE_CODE_POINTS)
    : { text: undefined, truncated: false };
  const det = truncateDetails(data.details);
  const logWrap = truncateLogs(data.logs);

  return {
    ok: true,
    envelope: {
      schemaVersion: 1,
      status: data.status,
      message: msgTrim.text,
      details: det.value,
      logs: logWrap.value,
      truncated: {
        ...(msgTrim.truncated ? { message: true } : {}),
        ...(det.truncated ? { details: true } : {}),
        ...(logWrap.truncated ? { logs: true } : {}),
        ...(logWrap.logEntryMessages.length > 0
          ? { logEntryMessages: logWrap.logEntryMessages }
          : {}),
      },
    },
  };
};
