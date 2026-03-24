import { prisma } from "@hermes/orchestration-database";
import type { Prisma } from "@hermes/orchestration-database";
import { cookies, headers } from "next/headers";
import type { NextResponse } from "next/server";

export type DashboardUser = { id: string; name: string; email: string };

/**
 * GET route path that clears dashboard auth cookies and redirects to login.
 * Server Component layouts cannot call `cookies().set`; they must redirect here instead.
 */
export const HERMES_DASHBOARD_CLEAR_SESSION_PATH =
  "/clear-hermes-dashboard-session" as const;

export type SessionClearCookieOptions = {
  httpOnly: boolean;
  sameSite: "lax" | "strict" | "none";
  path: string;
  maxAge: number;
};

type SessionCookieStore = {
  set: (
    name: string,
    value: string,
    options: SessionClearCookieOptions,
  ) => void;
};

type ClearDashboardAuthCookiesDependencies = {
  getCookieStore?: () => Promise<SessionCookieStore>;
};

type HermesAdminAccessDependencies = {
  getSession?: typeof getDashboardSession;
  findUserForDashboard?: (
    userId: string,
  ) => Promise<{ role: string; isActive: boolean } | null>;
};

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
 * @returns The authenticated user (id, name, email) or null if auth-token or auth-user is missing/invalid.
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
      "id" in parsed &&
      "name" in parsed &&
      "email" in parsed &&
      typeof (parsed as DashboardUser).id === "string" &&
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

/**
 * Returns cookie options that expire the Hermes dashboard auth cookies immediately.
 *
 * @returns Options passed to `cookies().set` to clear `auth-token` and `auth-user`.
 */
export const createSessionClearCookieOptions =
  (): SessionClearCookieOptions => {
    return {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    };
  };

/**
 * Clears Hermes dashboard auth cookies on a `NextResponse` (Route Handlers / middleware).
 * Use this when `cookies().set` is not allowed (e.g. from a Server Component layout).
 *
 * @param response - Redirect (or other) response whose `Set-Cookie` headers will be updated.
 */
export const applyClearHermesDashboardAuthCookies = (
  response: NextResponse,
): void => {
  const clearOpts = createSessionClearCookieOptions();
  response.cookies.set("auth-token", "", clearOpts);
  response.cookies.set("auth-user", "", clearOpts);
};

/**
 * Creates a function that clears Hermes dashboard auth cookies (`auth-token`, `auth-user`).
 *
 * @param dependencies - Optional `getCookieStore` for tests.
 * @returns Async function that clears both cookies.
 */
export const createClearDashboardAuthCookies = ({
  getCookieStore = cookies,
}: ClearDashboardAuthCookiesDependencies = {}) => {
  /**
   * Clears dashboard session cookies.
   *
   * @returns Promise that resolves when cookies are cleared.
   */
  return async () => {
    const cookieStore = await getCookieStore();
    const clearOpts = createSessionClearCookieOptions();
    cookieStore.set("auth-token", "", clearOpts);
    cookieStore.set("auth-user", "", clearOpts);
  };
};

/** Default cookie clearer using Next.js `cookies()`. */
export const clearDashboardAuthCookies = createClearDashboardAuthCookies();

const defaultFindUserForDashboard = async (
  userId: string,
): Promise<{ role: string; isActive: boolean } | null> => {
  const args = {
    where: { id: userId },
    select: { role: true, isActive: true },
  } satisfies Prisma.UserFindUniqueArgs;
  return prisma.user.findUnique(args);
};

/**
 * Verifies the dashboard session cookie matches an active Hermes `ADMIN` user in the database.
 *
 * @param dependencies - Injectable session reader and user lookup (defaults use cookies + Prisma).
 * @returns `{ ok: true }` when the user may access the dashboard; `{ ok: false }` otherwise.
 */
export const resolveHermesActiveAdminDashboardAccess = async ({
  getSession = getDashboardSession,
  findUserForDashboard = defaultFindUserForDashboard,
}: HermesAdminAccessDependencies = {}): Promise<
  { ok: true } | { ok: false }
> => {
  const session = await getSession();
  if (!session) {
    return { ok: false };
  }

  const user = await findUserForDashboard(session.id);
  if (!user || user.role !== "ADMIN" || !user.isActive) {
    return { ok: false };
  }

  return { ok: true };
};

/**
 * Optional auth for route-action-gen `requestValidator.user`.
 * Returns `null` when unauthenticated so the request can still reach the handler
 * (use only for routes that intentionally allow anonymous access).
 *
 * @param _request - Optional request (ignored; session is read from next/headers).
 * @returns Dashboard user or `null` when not logged in.
 */
export const getDashboardSessionForRoute = async (
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- signature required by route-action-gen
  _request?: Request,
): Promise<DashboardUser | null> => getDashboardSession();

/**
 * Required auth for route-action-gen `requestValidator.user`.
 * Throws when unauthenticated so `processRequest` / `processFormAction` return 401 and the handler does not run.
 *
 * @param _request - Optional request (ignored; session is read from next/headers).
 * @returns Dashboard user (never `null`).
 */
export const requireDashboardSessionForRoute = async (
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- signature required by route-action-gen
  _request?: Request,
): Promise<DashboardUser> => {
  const session = await getDashboardSession();
  if (!session) {
    throw new Error("Unauthorized");
  }
  return session;
};
