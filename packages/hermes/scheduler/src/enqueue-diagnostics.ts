/**
 * Canonical JSON shapes for `ScheduleExecution.errors` / HTTP / manual execution rows.
 * Dashboard accepts legacy `{ message, timestamp }` plus richer PRD fields.
 */

export type EnqueuePhase = "planning" | "enqueue" | "transaction";

export type EnqueueDiagnosticException = {
  name?: string;
  message?: string;
  stack?: string;
};

export type EnqueueDiagnosticEntry = {
  message: string;
  timestamp: string;
  phase?: EnqueuePhase;
  code?: string;
  pipelineStepId?: string;
  severity?: string;
  exception?: EnqueueDiagnosticException;
  /** True when message or exception fields were truncated for persistence caps. */
  truncated?: boolean;
};

/** Default max characters per long text field (stack/message) before truncation. */
export const ENQUEUE_DIAGNOSTIC_MAX_FIELD_CHARS = 32_768;

const truncateField = (
  value: string | undefined,
  maxChars: number,
): { text: string; truncated: boolean } => {
  if (value == null || value === "") {
    return { text: "", truncated: false };
  }
  if (value.length <= maxChars) {
    return { text: value, truncated: false };
  }
  return {
    text: `${value.slice(0, maxChars)}…`,
    truncated: true,
  };
};

/**
 * Truncates very long `message` and `exception` strings for JSON persistence.
 * Sets `truncated: true` on the entry when any field was shortened.
 */
export const truncateEnqueueDiagnosticEntry = (
  entry: EnqueueDiagnosticEntry,
  maxChars: number = ENQUEUE_DIAGNOSTIC_MAX_FIELD_CHARS,
): EnqueueDiagnosticEntry => {
  let anyTruncated = false;
  const msg = truncateField(entry.message, maxChars);
  if (msg.truncated) anyTruncated = true;

  let exception: EnqueueDiagnosticException | undefined;
  if (entry.exception != null) {
    const name = truncateField(entry.exception.name, maxChars);
    const message = truncateField(entry.exception.message, maxChars);
    const stack = truncateField(entry.exception.stack, maxChars);
    if (name.truncated || message.truncated || stack.truncated) {
      anyTruncated = true;
    }
    if (
      name.text !== "" ||
      message.text !== "" ||
      stack.text !== ""
    ) {
      exception = {
        ...(name.text !== "" ? { name: name.text } : {}),
        ...(message.text !== "" ? { message: message.text } : {}),
        ...(stack.text !== "" ? { stack: stack.text } : {}),
      };
    }
  }

  return {
    ...entry,
    message: msg.text,
    ...(exception ? { exception } : {}),
    ...(anyTruncated || entry.truncated ? { truncated: true } : {}),
  };
};

export type DiagnosticFromCaughtErrorOptions = {
  phase: EnqueuePhase;
  /** Defaults to `new Date()`. */
  at?: Date;
  /** Prepended before the error message (colon-separated). */
  messagePrefix?: string;
  code?: string;
  pipelineStepId?: string;
};

/**
 * Builds one persisted diagnostic row from a thrown value, including
 * `exception.name` / `exception.stack` when `Error` is caught.
 */
export const diagnosticFromCaughtError = (
  err: unknown,
  options: DiagnosticFromCaughtErrorOptions,
): EnqueueDiagnosticEntry => {
  const timestamp = (options.at ?? new Date()).toISOString();
  const prefix = options.messagePrefix;

  if (err instanceof Error) {
    const body: string = prefix
      ? `${prefix}: ${err.message}`
      : err.message || String(err);
    const entry: EnqueueDiagnosticEntry = {
      message: body,
      timestamp,
      phase: options.phase,
      ...(options.code != null ? { code: options.code } : {}),
      ...(options.pipelineStepId != null
        ? { pipelineStepId: options.pipelineStepId }
        : {}),
      exception: {
        name: err.name,
        message: err.message,
        ...(err.stack != null && err.stack !== ""
          ? { stack: err.stack }
          : {}),
      },
    };
    return truncateEnqueueDiagnosticEntry(entry);
  }

  const body = prefix ? `${prefix}: ${String(err)}` : String(err);
  return truncateEnqueueDiagnosticEntry({
    message: body,
    timestamp,
    phase: options.phase,
    ...(options.code != null ? { code: options.code } : {}),
    ...(options.pipelineStepId != null
      ? { pipelineStepId: options.pipelineStepId }
      : {}),
  });
};
