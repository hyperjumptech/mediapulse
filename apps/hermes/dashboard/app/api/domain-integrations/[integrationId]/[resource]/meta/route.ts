import { NextResponse } from "next/server";

import { getDomainTableMeta } from "@/lib/domain-dashboard";
import {
  domainIntegrationFailureResponse,
  resolveDomainResourceTableViewOrNotFound,
} from "@/lib/domain-resource-table-api";
import { toDomainCustomActionSummary } from "@/lib/domain-resource-table-views";
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

  try {
    const meta = await getDomainTableMeta(integrationId, resource);

    return NextResponse.json({
      ...meta,
      customActions: meta.customActions.map(toDomainCustomActionSummary),
    });
  } catch (error) {
    return domainIntegrationFailureResponse(error);
  }
};
