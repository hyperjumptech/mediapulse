import { NextResponse } from "next/server";

import { resolveDashboardPrincipalOrUnauthorized } from "@/lib/require-dashboard-principal-response";
import { maskManualPipelineExecutionDetailForDisplay } from "@/lib/mask-json-secrets";
import { getManualPipelineExecutionDetail } from "@/lib/pipeline-executions";

/**
 * GET /api/pipelines/[pipelineId]/executions/[executionId]
 * Returns manual pipeline execution detail (steps + invocations) for admin debugging. Requires dashboard session.
 */
export async function GET(
  request: Request,
  context: {
    params: Promise<{ pipelineId: string; executionId: string }>;
  },
) {
  const auth = await resolveDashboardPrincipalOrUnauthorized(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { pipelineId, executionId } = await context.params;
  const detail = await getManualPipelineExecutionDetail(
    pipelineId,
    executionId,
  );
  if (!detail) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(maskManualPipelineExecutionDetailForDisplay(detail));
}
