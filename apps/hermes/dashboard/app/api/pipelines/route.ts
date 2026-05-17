import { NextResponse } from "next/server";

import { paginatedListJsonResponse } from "@/lib/api-paginated-list-response";
import { parseApiPageParams } from "@/lib/parse-api-page-params";
import { getPipelinesPage } from "@/lib/pipelines";
import { resolveDashboardPrincipalOrUnauthorized } from "@/lib/require-dashboard-principal-response";

/**
 * GET /api/pipelines — paginated pipeline list for MCP discovery.
 *
 * Query: `page` (default 1), `pageSize` (default 20, max 100).
 * Response: `{ items, total, page, pageSize }` where each item includes ordered `steps`.
 */
export const GET = async (request: Request): Promise<NextResponse> => {
  const principal = await resolveDashboardPrincipalOrUnauthorized(request);
  if (principal instanceof NextResponse) {
    return principal;
  }

  const { page, pageSize } = parseApiPageParams(request);
  const result = await getPipelinesPage(page, pageSize);
  return paginatedListJsonResponse(
    result.pipelines,
    result.total,
    result.page,
    result.pageSize,
  );
};
