import { NextResponse } from "next/server";

import { applyClearHermesDashboardAuthCookies } from "@/lib/auth-dashboard";
import { resolvePublicOrigin } from "@/lib/resolve-public-origin";

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
