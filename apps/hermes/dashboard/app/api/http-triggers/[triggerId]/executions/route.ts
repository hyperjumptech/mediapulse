import { NextResponse } from "next/server";

import { paginatedListJsonResponse } from "@/lib/api-paginated-list-response";
import { getHttpTriggerExecutionsPage } from "@/lib/http-triggers";
import { parseApiPageParams } from "@/lib/parse-api-page-params";
import { resolveDashboardPrincipalOrUnauthorized } from "@/lib/require-dashboard-principal-response";

export const GET = async (
  request: Request,
  context: { params: Promise<{ triggerId: string }> },
): Promise<NextResponse> => {
  const principal = await resolveDashboardPrincipalOrUnauthorized(request);
  if (principal instanceof NextResponse) {
    return principal;
  }

  const { triggerId } = await context.params;
  const { page, pageSize } = parseApiPageParams(request);
  const result = await getHttpTriggerExecutionsPage(triggerId, page, pageSize);

  return paginatedListJsonResponse(
    result.executions,
    result.total,
    result.page,
    result.pageSize,
  );
};
