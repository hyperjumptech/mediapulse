import { NextResponse } from "next/server";

import {
  getAgentContractsPage,
  type AgentContractSortField,
} from "@/lib/agent-contracts";
import { paginatedListJsonResponse } from "@/lib/api-paginated-list-response";
import { parseApiListParams } from "@/lib/parse-api-page-params";
import { resolveDashboardPrincipalOrUnauthorized } from "@/lib/require-dashboard-principal-response";

const SORT_FIELDS = [
  "name",
  "createdAt",
] as const satisfies readonly AgentContractSortField[];

export const GET = async (request: Request): Promise<NextResponse> => {
  const principal = await resolveDashboardPrincipalOrUnauthorized(request);
  if (principal instanceof NextResponse) {
    return principal;
  }

  const { page, pageSize, search, sortBy, sortDir } = parseApiListParams(
    request,
    { fields: SORT_FIELDS, defaultField: "name" },
  );
  const result = await getAgentContractsPage(page, pageSize, {
    search,
    sortBy,
    sortDir,
  });

  return paginatedListJsonResponse(
    result.contracts,
    result.total,
    result.page,
    result.pageSize,
  );
};
