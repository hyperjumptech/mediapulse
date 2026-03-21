/**
 * Verifies a JWT (invocation token) via agent-auth-api POST /api/verify.
 * Used by agents, agent-data-api, and agent-registry-api so the same short-lived JWT
 * (issued by POST /api/token) is trusted for agent HTTP and Mediapulse data/registry calls.
 *
 * @param token - Raw JWT string (no `Bearer ` prefix); Hono bearer middleware passes this form.
 * @param authApiUrl - Base URL of agent-auth-api.
 * @returns true if the JWT is valid (200), false otherwise (401, 503, network error).
 */
export async function verifyTokenViaAuthApi(
  token: string,
  authApiUrl: string,
): Promise<boolean> {
  try {
    const res = await fetch(`${authApiUrl.replace(/\/$/, "")}/api/verify`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });

    return res.status === 200;
  } catch {
    return false;
  }
}

/**
 * Verifies an API key via agent-auth-api POST /api/verify-api-key.
 * Used by services that accept raw API keys (e.g. Hermes dashboard domain-integration registration),
 * not for agent-data-api or agent-registry-api bearer routes (those use JWT via `verifyTokenViaAuthApi`).
 *
 * @param apiKey - Raw API key (Bearer value).
 * @param authApiUrl - Base URL of agent-auth-api.
 * @returns true if the API key is valid and active (200), false otherwise (401, network error).
 */
export async function verifyApiKeyViaAuthApi(
  apiKey: string,
  authApiUrl: string,
): Promise<boolean> {
  try {
    const res = await fetch(
      `${authApiUrl.replace(/\/$/, "")}/api/verify-api-key`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
      },
    );

    return res.status === 200;
  } catch {
    return false;
  }
}
