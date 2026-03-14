/** Minimum seconds before expiry to still use cached token; refresh earlier than that. */
const REFRESH_BUFFER_SECONDS = 120;

/** Fetch-like function for token request (allows test mocks). */
export type FetchLike = (
  url: string,
  options?: RequestInit,
) => Promise<Response>;

export type AgentTokenClientDeps = {
  authApiUrl: string;
  credential: string;
  /** Optional fetch implementation (for tests). */
  fetchFn?: FetchLike;
};

type CachedToken = {
  token: string;
  expiresAtMs: number;
};

/**
 * Creates a client that fetches short-lived JWTs from agent-auth-api POST /api/token and caches them.
 * Use getToken() to obtain a valid Bearer token for agent invocation.
 *
 * @param deps - Auth API base URL, credential (scheduler API key), optional fetch.
 * @returns Object with getToken().
 */
export function createAgentTokenClient(deps: AgentTokenClientDeps): {
  getToken: () => Promise<string>;
} {
  const { authApiUrl, credential, fetchFn = fetch } = deps;
  const tokenUrl = `${authApiUrl.replace(/\/$/, "")}/api/token`;
  let cached: CachedToken | null = null;

  async function fetchNewToken(): Promise<CachedToken> {
    const res = await fetchFn(tokenUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${credential}`,
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(
        `Agent auth token request failed: ${res.status} ${res.statusText}${body ? ` ${body}` : ""}`,
      );
    }
    const data = (await res.json()) as { token?: string; expiresIn?: number };
    const token = data.token;
    const expiresIn = typeof data.expiresIn === "number" ? data.expiresIn : 900;
    if (!token || typeof token !== "string") {
      throw new Error("Agent auth API did not return a token");
    }
    const expiresAtMs = Date.now() + expiresIn * 1000;
    return { token, expiresAtMs };
  }

  /**
   * Returns a valid Bearer JWT, from cache or by fetching a new one.
   */
  async function getToken(): Promise<string> {
    const now = Date.now();
    const refreshAt = now + REFRESH_BUFFER_SECONDS * 1000;
    if (cached && cached.expiresAtMs > refreshAt) {
      return cached.token;
    }
    cached = await fetchNewToken();
    return cached.token;
  }

  return { getToken };
}
