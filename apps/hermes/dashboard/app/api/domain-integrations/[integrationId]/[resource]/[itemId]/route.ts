import { NextResponse } from "next/server";

import { getDomainTableItemById } from "@/lib/domain-dashboard";
import {
  domainIntegrationFailureResponse,
  resolveDomainResourceTableViewOrNotFound,
} from "@/lib/domain-resource-table-api";
import { resolveDashboardPrincipalOrUnauthorized } from "@/lib/require-dashboard-principal-response";

const isUnsafeItemId = (itemId: string): boolean =>
  itemId === "." || itemId === ".." || itemId.includes("/");

export const GET = async (
  request: Request,
  context: {
    params: Promise<{
      integrationId: string;
      resource: string;
      itemId: string;
    }>;
  },
): Promise<NextResponse> => {
  const principal = await resolveDashboardPrincipalOrUnauthorized(request);
  if (principal instanceof NextResponse) {
    return principal;
  }

  const { integrationId, resource, itemId } = await context.params;
  if (isUnsafeItemId(itemId)) {
    return NextResponse.json({ error: "Invalid item id" }, { status: 400 });
  }

  const view = await resolveDomainResourceTableViewOrNotFound(
    integrationId,
    resource,
  );
  if (view instanceof NextResponse) {
    return view;
  }

  try {
    const row = await getDomainTableItemById(integrationId, resource, itemId);
    if (!row) {
      return NextResponse.json({ error: "Row not found" }, { status: 404 });
    }

    return NextResponse.json(row);
  } catch (error) {
    return domainIntegrationFailureResponse(error);
  }
};
