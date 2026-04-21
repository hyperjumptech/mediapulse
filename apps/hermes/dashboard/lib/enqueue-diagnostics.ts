/**
 * Normalization and ordering for persisted `execution.errors` JSON on Hermes executions.
 */

export type EnqueueDiagnosticException = {
  name?: string;
  message?: string;
  stack?: string;
};

/** Loose shape: supports PRD canonical fields and legacy `{ message, timestamp }`. */
export type EnqueueDiagnosticEntry = {
  message?: string;
  timestamp?: string;
  severity?: string;
  phase?: string;
  code?: string;
  pipelineStepId?: string;
  exception?: EnqueueDiagnosticException;
};

export type NormalizeEnqueueErrorsResult =
  | { kind: "entries"; entries: EnqueueDiagnosticEntry[] }
  | { kind: "invalid"; raw: unknown };

const readOptionalString = (value: unknown): string | undefined => {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return undefined;
};

const pickException = (
  value: unknown,
): EnqueueDiagnosticException | undefined => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const o = value as Record<string, unknown>;
  const name = readOptionalString(o.name);
  const message = readOptionalString(o.message);
  const stack = readOptionalString(o.stack);
  if (name == null && message == null && stack == null) return undefined;
  return { name, message, stack };
};

const pickEntry = (item: Record<string, unknown>): EnqueueDiagnosticEntry => {
  const exception = pickException(item.exception);
  return {
    message: readOptionalString(item.message),
    timestamp: readOptionalString(item.timestamp),
    severity: readOptionalString(item.severity),
    phase: readOptionalString(item.phase),
    code: readOptionalString(item.code),
    pipelineStepId: readOptionalString(item.pipelineStepId),
    ...(exception ? { exception } : {}),
  };
};

/**
 * Validates that `errors` is an array of plain objects and maps each to {@link EnqueueDiagnosticEntry}.
 * Non-arrays or arrays containing a non-object element yield `invalid`.
 */
export const normalizeEnqueueErrorsPayload = (
  errors: unknown,
): NormalizeEnqueueErrorsResult => {
  if (errors === null || errors === undefined) {
    return { kind: "entries", entries: [] };
  }
  if (!Array.isArray(errors)) {
    return { kind: "invalid", raw: errors };
  }
  const entries: EnqueueDiagnosticEntry[] = [];
  for (const item of errors) {
    if (item === null || typeof item !== "object" || Array.isArray(item)) {
      return { kind: "invalid", raw: errors };
    }
    entries.push(pickEntry(item as Record<string, unknown>));
  }
  return { kind: "entries", entries };
};

export const parseEnqueueErrorTimestampMs = (
  timestamp: string | undefined,
): number | null => {
  if (timestamp == null || timestamp === "") return null;
  const ms = Date.parse(timestamp);
  return Number.isNaN(ms) ? null : ms;
};

/**
 * Oldest first by parseable ISO `timestamp`; entries without a parseable timestamp
 * follow, in original order.
 */
export const sortEnqueueErrorEntriesOldestFirst = (
  entries: EnqueueDiagnosticEntry[],
): EnqueueDiagnosticEntry[] => {
  const withMeta = entries.map((entry, originalIndex) => ({
    entry,
    originalIndex,
    ts: parseEnqueueErrorTimestampMs(entry.timestamp),
  }));
  const withTime = withMeta.filter((x) => x.ts !== null);
  const withoutTime = withMeta.filter((x) => x.ts === null);
  withTime.sort((a, b) => {
    if (a.ts !== b.ts) return (a.ts as number) - (b.ts as number);
    return a.originalIndex - b.originalIndex;
  });
  withoutTime.sort((a, b) => a.originalIndex - b.originalIndex);
  return [...withTime, ...withoutTime].map((x) => x.entry);
};

/** JSON preview for invalid payloads; never throws. */
export const safeJsonStringify = (value: unknown, indent = 2): string => {
  try {
    return JSON.stringify(value, null, indent);
  } catch {
    try {
      return String(value);
    } catch {
      return "[unserializable]";
    }
  }
};

export const isEnqueueDiagnosticsRelevant = (enqueueStatus: string): boolean =>
  enqueueStatus === "failed" || enqueueStatus === "partial";
