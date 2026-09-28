import { NextResponse } from "next/server";

import { paginatedListJsonResponse } from "@/lib/api-paginated-list-response";
import {
  getDomainIntegrationsPage,
  type DomainIntegrationSortField,
} from "@/lib/domain-integrations";
import { parseApiListParams } from "@/lib/parse-api-page-params";
import { resolveDashboardPrincipalOrUnauthorized } from "@/lib/require-dashboard-principal-response";

const SORT_FIELDS = [
  "isDefault",
  "integrationId",
  "name",
  "status",
] as const satisfies readonly DomainIntegrationSortField[];

export const GET = async (request: Request): Promise<NextResponse> => {
  const principal = await resolveDashboardPrincipalOrUnauthorized(request);
  if (principal instanceof NextResponse) {
    return principal;
  }

  const { page, pageSize, search, sortBy, sortDir } = parseApiListParams(
    request,
    {
      fields: SORT_FIELDS,
      defaultField: "isDefault",
      defaultDirection: "desc",
    },
  );
  const result = await getDomainIntegrationsPage(page, pageSize, {
    search,
    sortBy,
    sortDir,
  });

  return paginatedListJsonResponse(
    result.integrations,
    result.total,
    result.page,
    result.pageSize,
  );
};
