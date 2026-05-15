import { NextResponse } from "next/server";

import { paginatedListJsonResponse } from "@/lib/api-paginated-list-response";
import { getDomainIntegrationsPage } from "@/lib/domain-integrations";
import { parseApiPageParams } from "@/lib/parse-api-page-params";
import { resolveDashboardPrincipalOrUnauthorized } from "@/lib/require-dashboard-principal-response";

/**
 * GET /api/domain-integrations — paginated domain integration list for MCP discovery.
 *
 * Query: `page` (default 1), `pageSize` (default 20, max 100).
 * Response: `{ items, total, page, pageSize }` (includes pending and active rows; no API keys).
 */
export const GET = async (request: Request): Promise<NextResponse> => {
  const principal = await resolveDashboardPrincipalOrUnauthorized(request);
  if (principal instanceof NextResponse) {
    return principal;
  }

  const { page, pageSize } = parseApiPageParams(request);
  const result = await getDomainIntegrationsPage(page, pageSize);
  return paginatedListJsonResponse(
    result.integrations,
    result.total,
    result.page,
    result.pageSize,
  );
};
