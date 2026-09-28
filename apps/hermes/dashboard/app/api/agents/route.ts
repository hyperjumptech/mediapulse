import { NextResponse } from "next/server";

import { paginatedListJsonResponse } from "@/lib/api-paginated-list-response";
import { getAgentRegistryPage, type AgentSortField } from "@/lib/agents";
import { parseApiListParams } from "@/lib/parse-api-page-params";
import { resolveDashboardPrincipalOrUnauthorized } from "@/lib/require-dashboard-principal-response";

const SORT_FIELDS = [
  "agentId",
  "agentVersion",
  "created",
  "updated",
] as const satisfies readonly AgentSortField[];

export const GET = async (request: Request): Promise<NextResponse> => {
  const principal = await resolveDashboardPrincipalOrUnauthorized(request);
  if (principal instanceof NextResponse) {
    return principal;
  }

  const { page, pageSize, search, sortBy, sortDir } = parseApiListParams(
    request,
    { fields: SORT_FIELDS, defaultField: "agentId" },
  );
  const result = await getAgentRegistryPage(page, pageSize, {
    search,
    sortBy,
    sortDir,
  });

  return paginatedListJsonResponse(
    result.agents,
    result.total,
    result.page,
    result.pageSize,
  );
};
