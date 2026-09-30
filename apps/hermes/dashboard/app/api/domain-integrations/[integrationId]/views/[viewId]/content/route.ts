import { NextResponse } from "next/server";

import { fetchDomainContentView } from "@/lib/domain-content-view";
import {
  domainIntegrationFailureResponse,
  resolveActiveDomainIntegrationOrNotFound,
} from "@/lib/domain-resource-table-api";
import { listDomainContentViews } from "@/lib/domain-resource-table-views";
import { resolveDashboardPrincipalOrUnauthorized } from "@/lib/require-dashboard-principal-response";

export const GET = async (
  request: Request,
  context: { params: Promise<{ integrationId: string; viewId: string }> },
): Promise<NextResponse> => {
  const principal = await resolveDashboardPrincipalOrUnauthorized(request);
  if (principal instanceof NextResponse) {
    return principal;
  }

  const { integrationId, viewId } = await context.params;
  const integration =
    await resolveActiveDomainIntegrationOrNotFound(integrationId);
  if (integration instanceof NextResponse) {
    return integration;
  }
  const view = listDomainContentViews(integration).find(
    (contentView) => contentView.id === viewId,
  );
  if (!view) {
    return NextResponse.json(
      { error: `Content view "${viewId}" not found` },
      { status: 404 },
    );
  }
  const agentId =
    new URL(request.url).searchParams.get("agentId")?.trim() || undefined;

  try {
    const content = await fetchDomainContentView({
      integrationId,
      view,
      agentId,
      integration,
    });

    return NextResponse.json({ viewId, kind: view.kind, ...content });
  } catch (error) {
    return domainIntegrationFailureResponse(error);
  }
};
