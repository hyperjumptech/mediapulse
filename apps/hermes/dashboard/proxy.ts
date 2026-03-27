import { NextResponse } from "next/server";

import { getCookieFromHeader } from "@/lib/auth-dashboard";
import { resolvePublicOrigin } from "@/lib/resolve-public-origin";

/**
 * Hermes dashboard proxy: `/` has no public landing page. Send visitors to
 * `/dashboard` when the session cookie is present, otherwise `/login`.
 * Uses forwarded headers so redirects stay on the public host behind Fly, etc.
 *
 * @param request - Incoming request (matched to `/` only via `config.matcher`).
 * @returns Redirect or passthrough (defensive if pathname is not `/`).
 */
export function proxy(request: Request) {
  const url = new URL(request.url);
  if (url.pathname !== "/") {
    return NextResponse.next();
  }

  const token = getCookieFromHeader(
    request.headers.get("cookie"),
    "auth-token",
  );
  const path =
    token !== null && token.trim().length > 0 ? "/dashboard" : "/login";

  return NextResponse.redirect(new URL(path, resolvePublicOrigin(request)));
}

export const config = {
  matcher: "/",
};
