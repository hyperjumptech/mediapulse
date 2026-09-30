import { NextResponse } from "next/server";

import { paginatedListJsonResponse } from "@/lib/api-paginated-list-response";
import { getPipelineExecutionsPage } from "@/lib/pipeline-executions";
import { parseApiPageParams } from "@/lib/parse-api-page-params";
import { resolveDashboardPrincipalOrUnauthorized } from "@/lib/require-dashboard-principal-response";

export const GET = async (
  request: Request,
  context: { params: Promise<{ pipelineId: string }> },
): Promise<NextResponse> => {
  const principal = await resolveDashboardPrincipalOrUnauthorized(request);
  if (principal instanceof NextResponse) {
    return principal;
  }

  const { pipelineId } = await context.params;
  const { page, pageSize } = parseApiPageParams(request);
  const result = await getPipelineExecutionsPage(pipelineId, page, pageSize);

  return paginatedListJsonResponse(
    result.executions,
    result.total,
    result.page,
    result.pageSize,
  );
};
