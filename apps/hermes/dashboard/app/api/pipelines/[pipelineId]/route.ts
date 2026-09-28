import { NextResponse } from "next/server";

import { getPipelineWithSteps } from "@/lib/pipelines";
import { resolveDashboardPrincipalOrUnauthorized } from "@/lib/require-dashboard-principal-response";

export const GET = async (
  request: Request,
  context: { params: Promise<{ pipelineId: string }> },
): Promise<NextResponse> => {
  const principal = await resolveDashboardPrincipalOrUnauthorized(request);
  if (principal instanceof NextResponse) {
    return principal;
  }

  const { pipelineId } = await context.params;
  const pipeline = await getPipelineWithSteps(pipelineId);
  if (!pipeline) {
    return NextResponse.json({ error: "Pipeline not found" }, { status: 404 });
  }

  return NextResponse.json(pipeline);
};
