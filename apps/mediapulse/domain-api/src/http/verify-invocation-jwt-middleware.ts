import { env } from "@mediapulse/env";

export type VerifyInvocationJwtOptions = {
  /** Override `env.AGENT_AUTH_API_URL` (e.g. tests). */
  authApiUrl?: string;
};

/**
 * True when the Authorization bearer is a JWT that agent-auth-api accepts for invocation
 * (`POST /api/verify`).
 *
 * When **`AGENT_AUTH_API_URL`** is unset, returns `true` (no remote verification; local dev).
 *
 * @param authHeader - Raw `Authorization` header value.
 * @param fetchImpl - Fetch implementation (inject in tests).
 * @param options - Optional `authApiUrl` override.
 * @returns Whether the request may proceed.
 */
export async function verifyInvocationJwtFromHeader(
  authHeader: string | undefined,
  fetchImpl: typeof fetch = fetch,
  options?: VerifyInvocationJwtOptions,
): Promise<boolean> {
  const base = (options?.authApiUrl ?? env.AGENT_AUTH_API_URL)?.replace(
    /\/$/,
    "",
  );
  if (!base) {
    return true;
  }

  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : "";
  if (!token) {
    return false;
  }

  const res = await fetchImpl(`${base}/api/verify`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    return false;
  }

  const data = (await res.json()) as { valid?: boolean };
  return data.valid === true;
}
