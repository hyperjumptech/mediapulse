/**
 * Extracts a human-readable `message` from JSON error bodies returned by agents
 * (e.g. `createAgentApp` 4xx responses with `{ message, agentId, skipped }`).
 *
 * @param rawBody - Response body text from the HTTP client.
 * @returns The `message` field when it is a non-empty string; otherwise `undefined`.
 */
export const parseHttpErrorBodyMessage = (
  rawBody: string,
): string | undefined => {
  const trimmed = rawBody.trim();
  if (trimmed.length === 0 || trimmed[0] !== "{") {
    return undefined;
  }
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (parsed && typeof parsed === "object" && parsed !== null) {
      const message = (parsed as { message?: unknown }).message;
      if (typeof message === "string" && message.length > 0) {
        return message;
      }
    }
  } catch {
    return undefined;
  }
  return undefined;
};
