import { NextResponse } from "next/server";

import { getDashboardSession } from "@/lib/auth-dashboard";
import { maskManualPipelineExecutionDetailForDisplay } from "@/lib/mask-json-secrets";
import { getManualPipelineExecutionDetail } from "@/lib/pipeline-executions";

/**
 * GET /api/pipelines/[pipelineId]/executions/[executionId]
 * Returns manual pipeline execution detail (steps + invocations) for admin debugging. Requires dashboard session.
 */
export async function GET(
  _request: Request,
  context: {
    params: Promise<{ pipelineId: string; executionId: string }>;
  },
) {
  const session = await getDashboardSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
