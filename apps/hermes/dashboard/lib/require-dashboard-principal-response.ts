import { NextResponse } from "next/server";

import {
  DASHBOARD_UNAUTHORIZED_BODY,
  type DashboardPrincipal,
  resolveDashboardPrincipal,
} from "@/lib/auth-dashboard";

/**
 * Resolves the dashboard principal or returns a 401 JSON response.
 *
 * @param request - Incoming HTTP request.
 * @returns Principal or `NextResponse` with status 401.
 */
export const resolveDashboardPrincipalOrUnauthorized = async (
  request: Request,
): Promise<DashboardPrincipal | NextResponse> => {
  const principal = await resolveDashboardPrincipal(request);
  if (!principal) {
    return NextResponse.json(DASHBOARD_UNAUTHORIZED_BODY, { status: 401 });
  }
  return principal;
};
