import { NextResponse } from "next/server";

import { paginatedListJsonResponse } from "@/lib/api-paginated-list-response";
import { domainIntegrationFailureResponse } from "@/lib/domain-resource-table-api";
import { parseApiPageParams } from "@/lib/parse-api-page-params";
import { getProcessedUrlsForApi } from "@/lib/processed-urls-api";
import { resolveDashboardPrincipalOrUnauthorized } from "@/lib/require-dashboard-principal-response";

const DEFAULT_PAGE_SIZE = 50;

const optionalFilter = (value: string | null): string | undefined =>
  value?.trim() || undefined;

export const GET = async (
  request: Request,
  context: { params: Promise<{ scheduleId: string; executionId: string }> },
): Promise<NextResponse> => {
  const principal = await resolveDashboardPrincipalOrUnauthorized(request);
  if (principal instanceof NextResponse) {
    return principal;
  }

  const { scheduleId, executionId } = await context.params;
  const { page, pageSize } = parseApiPageParams(request, {
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const searchParams = new URL(request.url).searchParams;
  try {
    const result = await getProcessedUrlsForApi({
      scheduleId,
      executionId,
      page,
      pageSize,
      subjectId: optionalFilter(searchParams.get("subjectId")),
      agent: optionalFilter(searchParams.get("agent")),
      status: optionalFilter(searchParams.get("status")),
      gateStatus: optionalFilter(searchParams.get("gateStatus")),
    });
    if (!result) {
      return NextResponse.json(
        { error: "Schedule execution not found" },
        { status: 404 },
      );
    }

    return paginatedListJsonResponse(
      result.items,
      result.total,
      result.page,
      result.pageSize,
    );
  } catch (error) {
    return domainIntegrationFailureResponse(error);
  }
};
