import { cookies, headers } from "next/headers";

export type DashboardUser = { name: string; email: string };

type CookieStore = Awaited<ReturnType<typeof cookies>>;

type GetCookieStore = () => Promise<CookieStore>;

type GetHeaders = () => Promise<Headers>;

/**
 * Parses a Cookie header string and returns the value for a given name.
 *
 * @param cookieHeader - Raw Cookie header value (e.g. "auth-token=xyz; auth-user=%7B%22...")
 * @param name - Cookie name to look up.
 * @returns Decoded cookie value or null.
 */
export const getCookieFromHeader = (
  cookieHeader: string | null,
  name: string,
): string | null => {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(";").map((s) => s.trim());
  for (const part of parts) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    if (key === name) {
      const value = part.slice(eq + 1).trim();
      try {
        return decodeURIComponent(value);
      } catch {
        return value;
      }
    }
  }
  return null;
};

/**
 * Returns the current dashboard session by reading auth cookies.
 * Tries next/headers cookies() first; if auth cookies are missing (e.g. in Server Action context),
 * falls back to parsing the Cookie header so pipeline actions receive the same session as the layout.
 *
 * @param dependencies - Optional getCookieStore and getHeaders for tests.
 * @returns The authenticated user (name, email) or null if auth-token or auth-user is missing/invalid.
 */
export const getDashboardSession = async ({
  getCookieStore = cookies,
  getHeaders = headers,
}: {
  getCookieStore?: GetCookieStore;
  getHeaders?: GetHeaders;
} = {}): Promise<DashboardUser | null> => {
  const cookieStore = await getCookieStore();
  let token = cookieStore.get("auth-token")?.value ?? null;
  let raw = cookieStore.get("auth-user")?.value ?? null;

  if (!token || !raw) {
    const headersStore = await getHeaders();
    const cookieHeader = headersStore.get("cookie");
    token = token ?? getCookieFromHeader(cookieHeader, "auth-token");
    raw = raw ?? getCookieFromHeader(cookieHeader, "auth-user");
  }

  if (!token || !raw) return null;

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed &&
      typeof parsed === "object" &&
      "name" in parsed &&
      "email" in parsed &&
      typeof (parsed as DashboardUser).name === "string" &&
      typeof (parsed as DashboardUser).email === "string"
    ) {
      return parsed as DashboardUser;
    }
  } catch {
    // ignore
  }
  return null;
};
