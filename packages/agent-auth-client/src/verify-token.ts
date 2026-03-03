/**
 * Verifies an API key by calling the agent-auth-api POST /api/verify endpoint.
 * Returns true if the key is valid (200), false otherwise (401, network error).
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
