import { NextResponse } from "next/server";

import { maskScheduleExecutionDetailForDisplay } from "@/lib/mask-json-secrets";
import { getScheduleExecutionDetail } from "@/lib/schedules";
import { resolveDashboardPrincipalOrUnauthorized } from "@/lib/require-dashboard-principal-response";

/**
 * GET /api/schedules/[scheduleId]/executions/[executionId]
 * Returns execution detail (steps + invocations) for admin debugging. Requires dashboard session.
 *
 * Parity: same response shape conventions as
 * `/api/http-triggers/.../executions/...` and `/api/pipelines/.../executions/...`
 * (including `execution.errors` from the DB row, secret-masked).
 */
export async function GET(
  request: Request,
  context: {
    params: Promise<{ scheduleId: string; executionId: string }>;
  },
) {
  const auth = await resolveDashboardPrincipalOrUnauthorized(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { scheduleId, executionId } = await context.params;
  const detail = await getScheduleExecutionDetail(scheduleId, executionId);
  if (!detail) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(maskScheduleExecutionDetailForDisplay(detail));
}
