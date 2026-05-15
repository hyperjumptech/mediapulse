import { NextResponse } from "next/server";

import { paginatedListJsonResponse } from "@/lib/api-paginated-list-response";
import { parseApiPageParams } from "@/lib/parse-api-page-params";
import { resolveDashboardPrincipalOrUnauthorized } from "@/lib/require-dashboard-principal-response";
import { getVariablesPage } from "@/lib/variables";

/**
 * GET /api/variables — paginated variable list for MCP discovery.
 *
 * Query: `page` (default 1), `pageSize` (default 20, max 100).
 * Response: `{ items, total, page, pageSize }`. Secret values are redacted (`isSecret` → placeholder).
 */
export const GET = async (request: Request): Promise<NextResponse> => {
  const principal = await resolveDashboardPrincipalOrUnauthorized(request);
  if (principal instanceof NextResponse) {
    return principal;
  }

  const { page, pageSize } = parseApiPageParams(request);
  const result = await getVariablesPage(page, pageSize);
  return paginatedListJsonResponse(
    result.variables,
    result.total,
    result.page,
    result.pageSize,
  );
};
