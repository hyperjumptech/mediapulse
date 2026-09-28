import { NextResponse } from "next/server";

import { paginatedListJsonResponse } from "@/lib/api-paginated-list-response";
import { parseApiListParams } from "@/lib/parse-api-page-params";
import {
  getPipelineListItemsPage,
  type PipelineSortField,
} from "@/lib/pipeline-summaries";
import { resolveDashboardPrincipalOrUnauthorized } from "@/lib/require-dashboard-principal-response";

const SORT_FIELDS = [
  "name",
  "updated",
] as const satisfies readonly PipelineSortField[];

export const GET = async (request: Request): Promise<NextResponse> => {
  const principal = await resolveDashboardPrincipalOrUnauthorized(request);
  if (principal instanceof NextResponse) {
    return principal;
  }

  const query = parseApiListParams(request, {
    fields: SORT_FIELDS,
    defaultField: "updated",
    defaultDirection: "desc",
  });
  const result = await getPipelineListItemsPage(query);

  return paginatedListJsonResponse(
    result.pipelines,
    result.total,
    result.page,
    result.pageSize,
  );
};
