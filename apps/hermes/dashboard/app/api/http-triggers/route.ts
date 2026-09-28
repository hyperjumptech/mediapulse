import { NextResponse } from "next/server";

import { paginatedListJsonResponse } from "@/lib/api-paginated-list-response";
import {
  getHttpTriggersPage,
  type HttpTriggerSortField,
} from "@/lib/http-triggers";
import { parseApiListParams } from "@/lib/parse-api-page-params";
import { resolveDashboardPrincipalOrUnauthorized } from "@/lib/require-dashboard-principal-response";

const SORT_FIELDS = [
  "name",
  "created",
  "enabled",
  "method",
] as const satisfies readonly HttpTriggerSortField[];

export const GET = async (request: Request): Promise<NextResponse> => {
  const principal = await resolveDashboardPrincipalOrUnauthorized(request);
  if (principal instanceof NextResponse) {
    return principal;
  }

  const { page, pageSize, search, sortBy, sortDir } = parseApiListParams(
    request,
    { fields: SORT_FIELDS, defaultField: "name" },
  );
  const result = await getHttpTriggersPage(page, pageSize, {
    search,
    sortBy,
    sortDir,
  });

  return paginatedListJsonResponse(
    result.httpTriggers,
    result.total,
    result.page,
    result.pageSize,
  );
};
