import { NextResponse } from "next/server";

import { loadHermesAdminsForPage } from "@/lib/hermes-admins-page";
import { resolveDashboardPrincipalOrUnauthorized } from "@/lib/require-dashboard-principal-response";

export const GET = async (request: Request): Promise<NextResponse> => {
  const principal = await resolveDashboardPrincipalOrUnauthorized(request);
  if (principal instanceof NextResponse) {
    return principal;
  }

  const admins = await loadHermesAdminsForPage();

  return NextResponse.json({ admins });
};
