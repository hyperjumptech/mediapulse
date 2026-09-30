import { NextResponse } from "next/server";

import { paginatedListJsonResponse } from "@/lib/api-paginated-list-response";
import { getScheduleExecutionsPage } from "@/lib/schedules";
import { parseApiPageParams } from "@/lib/parse-api-page-params";
import { resolveDashboardPrincipalOrUnauthorized } from "@/lib/require-dashboard-principal-response";

export const GET = async (
  request: Request,
  context: { params: Promise<{ scheduleId: string }> },
): Promise<NextResponse> => {
  const principal = await resolveDashboardPrincipalOrUnauthorized(request);
  if (principal instanceof NextResponse) {
    return principal;
  }

  const { scheduleId } = await context.params;
  const { page, pageSize } = parseApiPageParams(request);
  const result = await getScheduleExecutionsPage(scheduleId, page, pageSize);

  return paginatedListJsonResponse(
    result.executions,
    result.total,
    result.page,
    result.pageSize,
  );
};
