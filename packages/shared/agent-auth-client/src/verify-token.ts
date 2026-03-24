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
