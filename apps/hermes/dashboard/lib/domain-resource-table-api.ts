import type { ResourceTableView } from "@hermes/domain-contract";
import { NextResponse } from "next/server";

import { DomainIntegrationTimeoutError } from "./domain-integration-request";
import {
  getDomainIntegrationByIntegrationId,
  type DomainIntegrationRecord,
} from "./domain-integrations";
import { findDomainResourceTableView } from "./domain-resource-table-views";

export const resolveActiveDomainIntegrationOrNotFound = async (
  integrationId: string,
): Promise<DomainIntegrationRecord | NextResponse> => {
  const integration = await getDomainIntegrationByIntegrationId(integrationId);
  if (!integration) {
    return NextResponse.json(
      { error: `Domain integration "${integrationId}" is not active` },
      { status: 404 },
    );
  }

  return integration;
};

export const resolveDomainResourceTableViewOrNotFound = async (
  integrationId: string,
  resource: string,
): Promise<ResourceTableView | NextResponse> => {
  const integration =
    await resolveActiveDomainIntegrationOrNotFound(integrationId);
  if (integration instanceof NextResponse) {
    return integration;
  }

  const view = findDomainResourceTableView(integration, resource);
  if (!view) {
    return NextResponse.json(
      {
        error: `Resource-table view "${resource}" is not registered for "${integrationId}"`,
      },
      { status: 404 },
    );
  }

  return view;
};

export const domainIntegrationFailureResponse = (
  error: unknown,
): NextResponse => {
  const message = error instanceof Error ? error.message : String(error);
  const status = error instanceof DomainIntegrationTimeoutError ? 504 : 502;

  return NextResponse.json(
    { error: "Domain integration request failed", message },
    { status },
  );
};
