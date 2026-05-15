import { NextResponse } from "next/server";

import { paginatedListJsonResponse } from "@/lib/api-paginated-list-response";
import { getAgentConfigsPage } from "@/lib/agent-configs";
import { parseApiPageParams } from "@/lib/parse-api-page-params";
import { resolveDashboardPrincipalOrUnauthorized } from "@/lib/require-dashboard-principal-response";

/**
 * GET /api/agent-configs — paginated agent config list for MCP discovery.
 *
 * Query: `page` (default 1), `pageSize` (default 20, max 100).
 * Response: `{ items, total, page, pageSize }`.
 */
export const GET = async (request: Request): Promise<NextResponse> => {
  const principal = await resolveDashboardPrincipalOrUnauthorized(request);
  if (principal instanceof NextResponse) {
    return principal;
  }

  const { page, pageSize } = parseApiPageParams(request);
  const result = await getAgentConfigsPage(page, pageSize);
  return paginatedListJsonResponse(
    result.configs,
    result.total,
    result.page,
    result.pageSize,
  );
};
