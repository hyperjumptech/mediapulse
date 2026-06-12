import { NextResponse } from "next/server";
import type { ContentGenerationRunOutcome } from "@workspace/agent-data-api-contract";

import { listContentGenerationRuns } from "@mediapulse/hermes-dashboard";
import { getMediapulseHermesDashboardRuntimeConfig } from "@/lib/mediapulse-hermes-dashboard-config";
import { parseApiPageParams } from "@/lib/parse-api-page-params";
import { resolveDashboardPrincipalOrUnauthorized } from "@/lib/require-dashboard-principal-response";

const parseOptionalOutcome = (
  value: string | null,
): ContentGenerationRunOutcome | undefined => {
  if (value === "success" || value === "skipped" || value === "failed") {
    return value;
  }
  return undefined;
};

/**
 * GET /api/agents/content-generation-runs — content-generation run list for MCP discovery.
 *
 * Query: `page` (default 1; must be 1 unless `cursor` is set), `pageSize` (default 20, max 100),
 * `cursor` (optional UUID for next page), `outcome`, `tickerId`, `startTime`, `endTime`.
 * Response: `{ items, page, pageSize, nextCursor? }` (cursor-backed; `total` is omitted).
 */
export const GET = async (request: Request): Promise<NextResponse> => {
  const principal = await resolveDashboardPrincipalOrUnauthorized(request);
  if (principal instanceof NextResponse) {
    return principal;
  }

  const url = new URL(request.url);
  const { page, pageSize } = parseApiPageParams(request);
  const cursor = url.searchParams.get("cursor") ?? undefined;

  if (page > 1 && !cursor) {
    return NextResponse.json(
      {
        error: "page > 1 requires cursor from a previous response (nextCursor)",
      },
      { status: 400 },
    );
  }

  const tickerId = url.searchParams.get("tickerId")?.trim() || undefined;
  const startTime = url.searchParams.get("startTime")?.trim() || undefined;
  const endTime = url.searchParams.get("endTime")?.trim() || undefined;
  const outcome = parseOptionalOutcome(url.searchParams.get("outcome"));

  const result = await listContentGenerationRuns(
    {
      cursor,
      limit: pageSize,
      outcome,
      tickerId,
      startTime,
      endTime,
    },
    getMediapulseHermesDashboardRuntimeConfig(),
  );

  return NextResponse.json({
    items: result.items,
    page,
    pageSize,
    ...(result.nextCursor ? { nextCursor: result.nextCursor } : {}),
  });
};
