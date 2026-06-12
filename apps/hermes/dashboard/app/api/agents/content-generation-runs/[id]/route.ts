import { NextResponse } from "next/server";

import { loadHermesDashboardExtensions } from "@/lib/load-hermes-dashboard-extensions";
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

  const extensions = await loadHermesDashboardExtensions();
  if (!extensions) {
    return NextResponse.json(
      { error: "Operator diagnostics extensions are not configured" },
      { status: 404 },
    );
  }

  const { id } = await context.params;
  const config = extensions.getRuntimeConfig();
  const run = await extensions.getContentGenerationRunById(id, config);
  if (!run) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ item: run });
};
