import { NextResponse } from "next/server";

import { listActiveMcpApiKeys } from "@/lib/mcp-api-keys";
import { resolveDashboardPrincipalOrUnauthorized } from "@/lib/require-dashboard-principal-response";

export const GET = async (request: Request): Promise<NextResponse> => {
  const principal = await resolveDashboardPrincipalOrUnauthorized(request);
  if (principal instanceof NextResponse) {
    return principal;
  }

  const apiKeys = await listActiveMcpApiKeys();

  return NextResponse.json({ apiKeys });
};
