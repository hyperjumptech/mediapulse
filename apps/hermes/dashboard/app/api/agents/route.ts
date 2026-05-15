import { NextResponse } from "next/server";

import { paginatedListJsonResponse } from "@/lib/api-paginated-list-response";
import { getAgentsPage } from "@/lib/agents";
import { parseApiPageParams } from "@/lib/parse-api-page-params";
import { resolveDashboardPrincipalOrUnauthorized } from "@/lib/require-dashboard-principal-response";

/**
 * GET /api/agents — paginated agent registry list for MCP discovery.
 *
 * Query: `page` (default 1), `pageSize` (default 20, max 100).
 * Response: `{ items, total, page, pageSize }` where each item includes `domainIntegration.integrationId`.
 */
export const GET = async (request: Request): Promise<NextResponse> => {
  const principal = await resolveDashboardPrincipalOrUnauthorized(request);
  if (principal instanceof NextResponse) {
    return principal;
  }

  const { page, pageSize } = parseApiPageParams(request);
  const result = await getAgentsPage(page, pageSize);
  return paginatedListJsonResponse(
    result.agents,
    result.total,
    result.page,
    result.pageSize,
  );
};
