import { NextResponse } from "next/server";

import { paginatedListJsonResponse } from "@/lib/api-paginated-list-response";
import { getDomainTableList } from "@/lib/domain-dashboard";
import {
  domainIntegrationFailureResponse,
  resolveDomainResourceTableViewOrNotFound,
} from "@/lib/domain-resource-table-api";
import {
  parseDomainTableFilterValues,
  resolveDomainTableListSort,
} from "@/lib/domain-table-list-params";
import { parseApiListQuery } from "@/lib/parse-api-page-params";
import { resolveDashboardPrincipalOrUnauthorized } from "@/lib/require-dashboard-principal-response";

export const GET = async (
  request: Request,
  context: { params: Promise<{ integrationId: string; resource: string }> },
): Promise<NextResponse> => {
  const principal = await resolveDashboardPrincipalOrUnauthorized(request);
  if (principal instanceof NextResponse) {
    return principal;
  }

  const { integrationId, resource } = await context.params;
  const view = await resolveDomainResourceTableViewOrNotFound(
    integrationId,
    resource,
  );
  if (view instanceof NextResponse) {
    return view;
  }

  const { page, pageSize, search, sort, dir } = parseApiListQuery(request);
  const requestSearchParams = Object.fromEntries(
    new URL(request.url).searchParams,
  );
  const filters = parseDomainTableFilterValues(
    requestSearchParams,
    view.listFilters ?? [],
  );
  const { sortBy, sortDir } = resolveDomainTableListSort({ sort, dir }, view);

  try {
    const list = await getDomainTableList(integrationId, resource, {
      page,
      pageSize,
      query: search,
      sortBy,
      sortDir,
      filters,
    });

    return paginatedListJsonResponse(
      list.items,
      list.total,
      list.page,
      list.pageSize,
    );
  } catch (error) {
    return domainIntegrationFailureResponse(error);
  }
};
