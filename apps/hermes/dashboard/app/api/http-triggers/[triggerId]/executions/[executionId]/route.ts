import { NextResponse } from "next/server";

import { getDashboardSession } from "@/lib/auth-dashboard";
import { getHttpTriggerExecutionDetail } from "@/lib/http-triggers";
import { maskHttpTriggerExecutionDetailForDisplay } from "@/lib/mask-json-secrets";

/**
 * GET /api/http-triggers/[triggerId]/executions/[executionId]
 * Returns execution detail (steps + invocations) for admin debugging. Requires dashboard session.
 */
export async function GET(
  _request: Request,
  context: {
    params: Promise<{ triggerId: string; executionId: string }>;
  },
) {
  const session = await getDashboardSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { triggerId, executionId } = await context.params;
  const detail = await getHttpTriggerExecutionDetail(triggerId, executionId);
  if (!detail) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(maskHttpTriggerExecutionDetailForDisplay(detail));
}
