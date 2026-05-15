import { NextResponse } from "next/server";

import {
  DASHBOARD_UNAUTHORIZED_BODY,
  resolveDashboardPrincipal,
} from "@/lib/auth-dashboard";

/**
 * GET /api/mcp/whoami — returns MCP key and owner identity (no secrets).
 */
export async function GET(request: Request) {
  const principal = await resolveDashboardPrincipal(request);
  if (!principal || principal.authMethod !== "api_key") {
    return NextResponse.json(DASHBOARD_UNAUTHORIZED_BODY, { status: 401 });
  }

  return NextResponse.json({
    label: principal.label,
    readOnly: principal.readOnly,
    keyId: principal.apiKeyId,
    user: {
      id: principal.user.id,
      email: principal.user.email,
      name: principal.user.name,
    },
  });
}
