import { NextResponse } from "next/server";

import { getHttpTriggerById } from "@/lib/http-triggers";
import { resolveDashboardPrincipalOrUnauthorized } from "@/lib/require-dashboard-principal-response";

export const GET = async (
  request: Request,
  context: { params: Promise<{ triggerId: string }> },
): Promise<NextResponse> => {
  const principal = await resolveDashboardPrincipalOrUnauthorized(request);
  if (principal instanceof NextResponse) {
    return principal;
  }

  const { triggerId } = await context.params;
  const httpTrigger = await getHttpTriggerById(triggerId);
  if (!httpTrigger) {
    return NextResponse.json(
      { error: "HTTP trigger not found" },
      { status: 404 },
    );
  }

  return NextResponse.json(httpTrigger);
};
