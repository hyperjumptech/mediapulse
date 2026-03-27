import { NextResponse } from "next/server";

import { applyClearHermesDashboardAuthCookies } from "@/lib/auth-dashboard";

/**
 * Origin for absolute redirects when `request.url` reflects the container (e.g. `0.0.0.0:3001`)
 * instead of the public host (Fly and other proxies set `x-forwarded-*`).
 *
 * @param request - Incoming request.
 * @returns Base URL origin (`https://…`) suitable for `new URL(path, origin)`.
 */
const resolvePublicOrigin = (request: Request): string => {
  const forwardedHost = request.headers
    .get("x-forwarded-host")
    ?.split(",")[0]
    ?.trim();
  if (!forwardedHost) {
    return new URL(request.url).origin;
  }
  const forwardedProto =
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ?? "https";
  return `${forwardedProto}://${forwardedHost}`;
};

/**
 * Clears dashboard session cookies and redirects to the login page.
 * Invoked from the dashboard layout when the session is invalid or the user is not an active admin.
 */
export const GET = (request: Request) => {
  const loginUrl = new URL("/login", resolvePublicOrigin(request));
  const response = NextResponse.redirect(loginUrl);
  applyClearHermesDashboardAuthCookies(response);
  return response;
};
