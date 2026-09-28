import { NextResponse } from "next/server";

import { paginatedListJsonResponse } from "@/lib/api-paginated-list-response";
import { parseApiListParams } from "@/lib/parse-api-page-params";
import { resolveDashboardPrincipalOrUnauthorized } from "@/lib/require-dashboard-principal-response";
import { getSchedulesPage, type ScheduleSortField } from "@/lib/schedules";

const SORT_FIELDS = [
  "name",
  "nextRunAt",
  "created",
  "enabled",
] as const satisfies readonly ScheduleSortField[];

export const GET = async (request: Request): Promise<NextResponse> => {
  const principal = await resolveDashboardPrincipalOrUnauthorized(request);
  if (principal instanceof NextResponse) {
    return principal;
  }

  const { page, pageSize, search, sortBy, sortDir } = parseApiListParams(
    request,
    { fields: SORT_FIELDS, defaultField: "name" },
  );
  const result = await getSchedulesPage(page, pageSize, {
    search,
    sortBy,
    sortDir,
  });

  return paginatedListJsonResponse(
    result.schedules,
    result.total,
    result.page,
    result.pageSize,
  );
};
