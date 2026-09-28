import { NextResponse } from "next/server";

import { paginatedListJsonResponse } from "@/lib/api-paginated-list-response";
import { parseApiListParams } from "@/lib/parse-api-page-params";
import { resolveDashboardPrincipalOrUnauthorized } from "@/lib/require-dashboard-principal-response";
import { getVariablesPage, type VariableSortField } from "@/lib/variables";

const SORT_FIELDS = [
  "key",
  "created",
] as const satisfies readonly VariableSortField[];

export const GET = async (request: Request): Promise<NextResponse> => {
  const principal = await resolveDashboardPrincipalOrUnauthorized(request);
  if (principal instanceof NextResponse) {
    return principal;
  }

  const { page, pageSize, search, sortBy, sortDir } = parseApiListParams(
    request,
    { fields: SORT_FIELDS, defaultField: "key" },
  );
  const result = await getVariablesPage(page, pageSize, {
    search,
    sortBy,
    sortDir,
  });

  return paginatedListJsonResponse(
    result.variables,
    result.total,
    result.page,
    result.pageSize,
  );
};
