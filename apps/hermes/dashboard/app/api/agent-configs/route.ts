import { NextResponse } from "next/server";

import { paginatedListJsonResponse } from "@/lib/api-paginated-list-response";
import {
  getAgentConfigsPage,
  type AgentConfigSortField,
} from "@/lib/agent-configs";
import { parseApiListParams } from "@/lib/parse-api-page-params";
import { resolveDashboardPrincipalOrUnauthorized } from "@/lib/require-dashboard-principal-response";

const SORT_FIELDS = [
  "name",
  "createdAt",
  "agentId",
] as const satisfies readonly AgentConfigSortField[];

export const GET = async (request: Request): Promise<NextResponse> => {
  const principal = await resolveDashboardPrincipalOrUnauthorized(request);
  if (principal instanceof NextResponse) {
    return principal;
  }

  const { page, pageSize, search, sortBy, sortDir } = parseApiListParams(
    request,
    { fields: SORT_FIELDS, defaultField: "name" },
  );
  const result = await getAgentConfigsPage(page, pageSize, {
    search,
    sortBy,
    sortDir,
  });

  return paginatedListJsonResponse(
    result.configs,
    result.total,
    result.page,
    result.pageSize,
  );
};
