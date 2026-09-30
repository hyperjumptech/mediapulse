import { NextResponse } from "next/server";

import { getDomainIntegrationByIntegrationId } from "@/lib/domain-integrations";
import {
  getPipelinesUsingExpansionString,
  getPipelinesUsingVariableKey,
} from "@/lib/pipeline-usage";
import { resolveDashboardPrincipalOrUnauthorized } from "@/lib/require-dashboard-principal-response";

const USAGE_QUERY_ERROR =
  "Pass variableKey, or integrationId together with expansionString";

export const GET = async (request: Request): Promise<NextResponse> => {
  const principal = await resolveDashboardPrincipalOrUnauthorized(request);
  if (principal instanceof NextResponse) {
    return principal;
  }

  const searchParams = new URL(request.url).searchParams;
  const variableKey = searchParams.get("variableKey")?.trim();
  const integrationId = searchParams.get("integrationId")?.trim();
  const expansionString = searchParams.get("expansionString")?.trim();
  if (variableKey) {
    const pipelines = await getPipelinesUsingVariableKey(variableKey);

    return NextResponse.json({ pipelines });
  }
  if (!integrationId || !expansionString) {
    return NextResponse.json({ error: USAGE_QUERY_ERROR }, { status: 400 });
  }
  const integration = await getDomainIntegrationByIntegrationId(integrationId);
  if (!integration) {
    return NextResponse.json(
      { error: "Domain integration not found" },
      { status: 404 },
    );
  }
  const pipelines = await getPipelinesUsingExpansionString(
    integration.id,
    expansionString,
  );

  return NextResponse.json({ pipelines });
};
