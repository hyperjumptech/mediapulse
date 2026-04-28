/** @vitest-environment node */

import { notFound } from "next/navigation";
import { env } from "@hermes/env";

import { PageHeader } from "@/components/page-header";
import { withAuthProtection } from "@/components/with-auth-protection";
import { getDashboardAgentDataApiClient } from "@/lib/agent-data-api-client";

import { ContentGenerationRunsTable } from "./content-generation-runs-table";
import { ContentGenerationRunsFilters } from "./content-generation-runs-filters";
import { CursorPagination } from "@/components/cursor-pagination";

const DEFAULT_LIMIT = 20;

/**
 * Content-generation runs list page. Fetches runs via the SDK and renders a table with cursor pagination and filters.
 * Gated by the HERMES_CGA_DIAGNOSTICS_ENABLED feature flag.
 */
const ContentGenerationRunsPage = async ({
  searchParams,
}: {
  searchParams:
    | Promise<{
        cursor?: string;
        prevCursor?: string;
        limit?: string;
        outcome?: string;
        tickerId?: string;
        startTime?: string;
        endTime?: string;
      }>
    | {
        cursor?: string;
        prevCursor?: string;
        limit?: string;
        outcome?: string;
        tickerId?: string;
        startTime?: string;
        endTime?: string;
      };
}) => {
  if (env.HERMES_CGA_DIAGNOSTICS_ENABLED !== "true") {
    notFound();
  }

  const resolved = await Promise.resolve(searchParams);
  const cursor = resolved.cursor || undefined;
  const prevCursor = resolved.prevCursor || undefined;
  const limit = Math.min(
    100,
    Math.max(
      1,
      parseInt(resolved.limit ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT,
    ),
  );
  const outcome = resolved.outcome || undefined;
  const tickerId = resolved.tickerId || undefined;
  const startTime = resolved.startTime || undefined;
  const endTime = resolved.endTime || undefined;

  const client = getDashboardAgentDataApiClient();
  let runs;
  let nextCursor: string | undefined;

  try {
    const result = await client.contentGenerationRuns.get({
      cursor,
      limit,
      outcome: outcome as "success" | "skipped" | "failed" | undefined,
      tickerId,
      startTime,
      endTime,
    });
    runs = result.data;
    nextCursor = result.nextCursor;
  } catch {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader
          title="CGA diagnostics"
          description="View content-generation run diagnostics."
        />
        <p className="text-muted-foreground">
          Unable to load content-generation runs. Please try again later.
        </p>
      </div>
    );
  }

  const extraParams: Record<string, string> = {};
  if (outcome) extraParams.outcome = outcome;
  if (tickerId) extraParams.tickerId = tickerId;
  if (startTime) extraParams.startTime = startTime;
  if (endTime) extraParams.endTime = endTime;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="CGA diagnostics"
        description="View content-generation run diagnostics."
      />
      <ContentGenerationRunsFilters
        outcome={outcome}
        tickerId={tickerId}
        startTime={startTime}
        endTime={endTime}
      />
      <ContentGenerationRunsTable runs={runs} />
      <CursorPagination
        basePath="/dashboard/agents/content-generation-runs"
        currentCursor={cursor}
        prevCursor={prevCursor}
        nextCursor={nextCursor}
        limit={limit}
        extraParams={extraParams}
        ariaLabel="CGA runs pagination"
      />
    </div>
  );
};

export default withAuthProtection(ContentGenerationRunsPage);
