import { env } from "@mediapulse/env/app-user-registration";

export type UnsubscribeStatus =
  | "unsubscribed"
  | "already_unsubscribed"
  | "not_found"
  | "invalid"
  | "expired";

export type UnsubscribeResponse = {
  status: UnsubscribeStatus;
  displaySymbol?: string;
};

export type UnsubscribeMethod = "link" | "one_click";

/**
 * Calls the agent-data-api unsubscribe endpoint to perform the actual unsubscribe.
 *
 * - Important: this WRITES (flips `UserTicker.enabled` to `false`). Only call it once the
 *   user has confirmed (`"link"`) or a mail client has issued an RFC 8058 one-click POST
 *   (`"one_click"`).
 *
 * @param token - Signed unsubscribe token.
 * @param method - Origin interaction method for audit.
 * @param fetchImpl - Injectable fetch for tests.
 * @returns Parsed API response.
 */
export const requestUnsubscribe = async (
  token: string,
  method: UnsubscribeMethod,
  fetchImpl: typeof fetch = fetch,
): Promise<UnsubscribeResponse> => {
  const endpoint = `${env.AGENT_DATA_API_URL.replace(/\/$/, "")}/api/v1/user-registration-unsubscribe`;

  if (method === "link") {
    const response = await fetchImpl(
      `${endpoint}?token=${encodeURIComponent(token)}`,
      { method: "GET", cache: "no-store" },
    );
    if (!response.ok) {
      throw new Error(
        `Unsubscribe lookup failed with status ${response.status}`,
      );
    }
    return (await response.json()) as UnsubscribeResponse;
  }

  const response = await fetchImpl(endpoint, {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
  if (!response.ok) {
    throw new Error(`Unsubscribe update failed with status ${response.status}`);
  }
  return (await response.json()) as UnsubscribeResponse;
};
