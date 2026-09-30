import { NextResponse } from "next/server";

import { resolveActiveDomainIntegrationOrNotFound } from "@/lib/domain-resource-table-api";
import {
  listDomainContentViews,
  listDomainResourceTableViews,
  toDomainContentViewSummary,
  toDomainResourceTableViewSummary,
} from "@/lib/domain-resource-table-views";
import { resolveDashboardPrincipalOrUnauthorized } from "@/lib/require-dashboard-principal-response";

export const GET = async (
  request: Request,
  context: { params: Promise<{ integrationId: string }> },
): Promise<NextResponse> => {
  const principal = await resolveDashboardPrincipalOrUnauthorized(request);
  if (principal instanceof NextResponse) {
    return principal;
  }

  const { integrationId } = await context.params;
  const integration =
    await resolveActiveDomainIntegrationOrNotFound(integrationId);
  if (integration instanceof NextResponse) {
    return integration;
  }

  const views = listDomainResourceTableViews(integration).map(
    toDomainResourceTableViewSummary,
  );

  const contentViews = listDomainContentViews(integration).map(
    toDomainContentViewSummary,
  );

  return NextResponse.json({ integrationId, views, contentViews });
};
