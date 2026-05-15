import { NextResponse } from "next/server";

import { getContentGenerationRunById } from "@/lib/content-generation-runs-api";
import { resolveDashboardPrincipalOrUnauthorized } from "@/lib/require-dashboard-principal-response";

/**
 * GET /api/agents/content-generation-runs/[id] — single content-generation run detail.
 *
 * Response: `{ item }` with the run row, or 404 when not found.
 */
export const GET = async (
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> => {
  const principal = await resolveDashboardPrincipalOrUnauthorized(request);
  if (principal instanceof NextResponse) {
    return principal;
  }

  const { id } = await context.params;
  const run = await getContentGenerationRunById(id);
  if (!run) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ item: run });
};
