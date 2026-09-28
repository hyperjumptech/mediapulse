import { NextResponse } from "next/server";

import {
  getCookieFromHeader,
  HERMES_DASHBOARD_CLEAR_SESSION_PATH,
  parseDashboardUserFromAuthCookie,
} from "@/lib/auth-dashboard";
import { resolvePublicOrigin } from "@/lib/resolve-public-origin";

type SessionCookieState = "missing" | "invalid" | "valid";

const readSessionCookieState = (request: Request): SessionCookieState => {
  const cookieHeader = request.headers.get("cookie");
  const token = getCookieFromHeader(cookieHeader, "auth-token")?.trim();
  const rawUser = getCookieFromHeader(cookieHeader, "auth-user");
  if (!token || !rawUser) {
    return "missing";
  }

  return parseDashboardUserFromAuthCookie(rawUser) ? "valid" : "invalid";
};

const isPageRequest = (request: Request, pathname: string): boolean => {
  const isReadMethod = request.method === "GET" || request.method === "HEAD";
  const hasAuthorizationHeader = request.headers.has("authorization");
  const isActionRoute = pathname.split("/").includes("actions");

  return isReadMethod && !hasAuthorizationHeader && !isActionRoute;
};

const redirectTo = (request: Request, path: string) => {
  return NextResponse.redirect(new URL(path, resolvePublicOrigin(request)));
};

export function proxy(request: Request) {
  const { pathname } = new URL(request.url);
  const sessionState = readSessionCookieState(request);

  if (pathname === "/") {
    return redirectTo(
      request,
      sessionState === "valid" ? "/dashboard" : "/login",
    );
  }

  if (!pathname.startsWith("/dashboard") || !isPageRequest(request, pathname)) {
    return NextResponse.next();
  }

  if (sessionState === "missing") {
    return redirectTo(request, "/login");
  }
  if (sessionState === "invalid") {
    return redirectTo(request, HERMES_DASHBOARD_CLEAR_SESSION_PATH);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/dashboard/:path*"],
};
