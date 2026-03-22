import { NextResponse } from "next/server";

import { getScheduleExecutionDetail } from "@/lib/schedules";
import { getDashboardSession } from "@/lib/auth-dashboard";

/**
 * GET /api/schedules/[scheduleId]/executions/[executionId]
 * Returns execution detail (steps + invocations) for admin debugging. Requires dashboard session.
 */
export async function GET(
  _request: Request,
  context: {
    params: Promise<{ scheduleId: string; executionId: string }>;
  },
) {
  const session = await getDashboardSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { scheduleId, executionId } = await context.params;
  const detail = await getScheduleExecutionDetail(scheduleId, executionId);
  if (!detail) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(detail);
}
