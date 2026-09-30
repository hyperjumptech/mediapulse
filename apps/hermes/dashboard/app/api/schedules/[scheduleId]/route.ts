import { NextResponse } from "next/server";

import { resolveDashboardPrincipalOrUnauthorized } from "@/lib/require-dashboard-principal-response";
import { getScheduleById } from "@/lib/schedules";

export const GET = async (
  request: Request,
  context: { params: Promise<{ scheduleId: string }> },
): Promise<NextResponse> => {
  const principal = await resolveDashboardPrincipalOrUnauthorized(request);
  if (principal instanceof NextResponse) {
    return principal;
  }

  const { scheduleId } = await context.params;
  const schedule = await getScheduleById(scheduleId);
  if (!schedule) {
    return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
  }

  return NextResponse.json(schedule);
};
