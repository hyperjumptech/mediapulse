const MAX_JSON_LENGTH = 800;

/**
 * Returns a short line explaining a failed invocation when Hermes persisted an `error` JSON object
 * (e.g. `{ message, retryable }`), or a bounded JSON string for other shapes.
 *
 * @param error - Value from `AgentJobExecution.error` (may be null for running/pending).
 * @returns Human-readable summary, or `null` if there is nothing to show.
 */
export const formatInvocationErrorSummary = (error: unknown): string | null => {
  if (error == null) {
    return null;
  }
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.length > 0) {
      return message;
    }
  }
  try {
    const serialized = JSON.stringify(error);
    return serialized.length > MAX_JSON_LENGTH
      ? `${serialized.slice(0, MAX_JSON_LENGTH)}…`
      : serialized;
  } catch {
    return String(error);
  }
};
