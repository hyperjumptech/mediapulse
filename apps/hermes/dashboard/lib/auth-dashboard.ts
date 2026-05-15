import { prisma, UserRole } from "@hermes/orchestration-database";
import type { Prisma } from "@hermes/orchestration-database";
import { cookies, headers } from "next/headers";
import type { NextResponse } from "next/server";
import { z } from "zod";

import { touchMcpApiKeyLastUsed, validateApiKey } from "@/lib/mcp-api-keys";
import { parseBearerToken } from "@/lib/parse-bearer-token";

/**
 * Zod schema for the JSON stored in the `auth-user` cookie.
 * Legacy payloads omit `credentialVersion`; non-integer values are treated as `0`.
 */
const dashboardAuthUserCookieSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  credentialVersion: z
    .unknown()
    .transform((v) => (typeof v === "number" && Number.isInteger(v) ? v : 0)),
});

/** Session payload stored in `auth-user` and validated against `User.credentialVersion` in the DB. */
export type DashboardUser = z.infer<typeof dashboardAuthUserCookieSchema>;

/** Authenticated caller for MCP-eligible routes (session cookie or MCP API key). */
export type DashboardPrincipal =
  | {
      authMethod: "session";
      user: DashboardUser;
    }
  | {
      authMethod: "api_key";
      user: DashboardUser;
      apiKeyId: string;
      readOnly: boolean;
      label: string;
    };

/** Stable JSON body for 401 responses from dashboard API routes. */
export const DASHBOARD_UNAUTHORIZED_BODY = { error: "Unauthorized" } as const;

/**
 * Parses the `auth-user` cookie JSON into a {@link DashboardUser}.
 * Legacy cookies without `credentialVersion` are treated as version `0`.
 *
 * @param raw - Decoded cookie string.
 * @returns Parsed user or `null` when invalid.
 */
export const parseDashboardUserFromAuthCookie = (
  raw: string,
): DashboardUser | null => {
  try {
    const parsed: unknown = JSON.parse(raw);
    const result = dashboardAuthUserCookieSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
};

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
  findUserForDashboard?: (userId: string) => Promise<{
    role: string;
    isActive: boolean;
    credentialVersion: number;
  } | null>;
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
/**
 * Reads dashboard session cookies from a `Request` (for route handlers).
 *
 * @param request - Incoming HTTP request.
 * @returns Parsed session user or null.
 */
export const getDashboardSessionFromRequest = (
  request: Request,
): DashboardUser | null => {
  const cookieHeader = request.headers.get("cookie");
  const token = getCookieFromHeader(cookieHeader, "auth-token");
  const raw = getCookieFromHeader(cookieHeader, "auth-user");
  if (!token || !raw) {
    return null;
  }
  return parseDashboardUserFromAuthCookie(raw);
};

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

  return parseDashboardUserFromAuthCookie(raw);
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

type DashboardUserRecord = {
  role: string;
  isActive: boolean;
  credentialVersion: number;
  name: string;
  email: string;
};

const defaultFindUserForDashboard = async (
  userId: string,
): Promise<{
  role: string;
  isActive: boolean;
  credentialVersion: number;
} | null> => {
  const args = {
    where: { id: userId },
    select: { role: true, isActive: true, credentialVersion: true },
  } satisfies Prisma.UserFindUniqueArgs;
  return prisma.user.findUnique(args);
};

const defaultFindUserProfileForDashboard = async (
  userId: string,
): Promise<DashboardUserRecord | null> => {
  const args = {
    where: { id: userId },
    select: {
      role: true,
      isActive: true,
      credentialVersion: true,
      name: true,
      email: true,
    },
  } satisfies Prisma.UserFindUniqueArgs;
  return prisma.user.findUnique(args);
};

/**
 * Returns true when the DB user is an active Hermes admin matching the session version.
 *
 * @param session - Cookie session payload.
 * @param user - Database user row.
 * @returns Whether the session is valid for dashboard access.
 */
export const isActiveAdminSessionMatch = (
  session: DashboardUser,
  user: { role: string; isActive: boolean; credentialVersion: number },
): boolean => {
  return (
    user.role === UserRole.ADMIN &&
    user.isActive &&
    user.credentialVersion === session.credentialVersion
  );
};

type ResolveDashboardPrincipalDependencies = {
  validateKey?: typeof validateApiKey;
  touchLastUsed?: typeof touchMcpApiKeyLastUsed;
  findUserProfile?: typeof defaultFindUserProfileForDashboard;
};

/**
 * Resolves the dashboard principal from Bearer MCP API key or session cookies.
 * API key is tried first. Updates `lastUsedAt` on successful API key auth.
 *
 * @param request - Incoming HTTP request.
 * @param dependencies - Injectable validators and DB lookups.
 * @returns Principal or null when credentials are missing or invalid.
 */
export const resolveDashboardPrincipal = async (
  request: Request,
  {
    validateKey = validateApiKey,
    touchLastUsed = touchMcpApiKeyLastUsed,
    findUserProfile = defaultFindUserProfileForDashboard,
  }: ResolveDashboardPrincipalDependencies = {},
): Promise<DashboardPrincipal | null> => {
  const bearer = parseBearerToken(request);
  if (bearer) {
    const key = await validateKey(bearer);
    if (!key) {
      return null;
    }
    const owner = await findUserProfile(key.createdByUserId);
    if (!owner || owner.role !== UserRole.ADMIN || !owner.isActive) {
      return null;
    }
    await touchLastUsed(key.id);
    return {
      authMethod: "api_key",
      user: {
        id: key.createdByUserId,
        name: owner.name,
        email: owner.email,
        credentialVersion: owner.credentialVersion,
      },
      apiKeyId: key.id,
      readOnly: key.readOnly,
      label: key.label,
    };
  }

  const session = getDashboardSessionFromRequest(request);
  if (!session) {
    return null;
  }
  const user = await defaultFindUserForDashboard(session.id);
  if (!user || !isActiveAdminSessionMatch(session, user)) {
    return null;
  }
  return { authMethod: "session", user: session };
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

  if (user.credentialVersion !== session.credentialVersion) {
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
 * Throws when unauthenticated, inactive, non-admin, or when the cookie's
 * `credentialVersion` does not match the database (password changed elsewhere).
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

  const user = await defaultFindUserForDashboard(session.id);
  if (!user || !isActiveAdminSessionMatch(session, user)) {
    throw new Error("Unauthorized");
  }

  return session;
};

/**
 * Required auth for route-action-gen: MCP API key or session cookie.
 *
 * @param request - Incoming HTTP request (Bearer or cookies).
 * @returns Dashboard user for the authenticated principal.
 */
export const requireDashboardPrincipalForRoute = async (
  request?: Request,
): Promise<DashboardUser> => {
  let principal: DashboardPrincipal | null = null;
  if (request) {
    principal = await resolveDashboardPrincipal(request);
  } else {
    const session = await getDashboardSession();
    if (session) {
      const user = await defaultFindUserForDashboard(session.id);
      if (user && isActiveAdminSessionMatch(session, user)) {
        principal = { authMethod: "session", user: session };
      }
    }
  }
  if (!principal) {
    throw new Error("Unauthorized");
  }
  return principal.user;
};

/**
 * Returns the dashboard user from a resolved principal or null.
 *
 * @param request - Incoming HTTP request.
 * @returns User when authenticated; otherwise null.
 */
export const getDashboardPrincipalUser = async (
  request: Request,
): Promise<DashboardUser | null> => {
  const principal = await resolveDashboardPrincipal(request);
  return principal?.user ?? null;
};
