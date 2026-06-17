/** @vitest-environment node */

import { notFound } from "next/navigation";

import { PageHeader } from "../components/page-header";
import { CursorPagination } from "../components/cursor-pagination";
import type { MediapulseHermesDashboardRuntimeConfig } from "../config";
import { CGA_DIAGNOSTICS_PATH_SEGMENT } from "../diagnostics-nav";
import { createMediapulseAgentDataApiClient } from "../lib/agent-data-api-client";

import { ContentGenerationRunsFilters } from "./content-generation-runs-filters";
import { ContentGenerationRunsTable } from "./content-generation-runs-table";

const DEFAULT_LIMIT = 20;

export type ContentGenerationRunsSearchParams = {
  cursor?: string;
  prevCursor?: string;
  limit?: string;
  outcome?: string;
  tickerId?: string;
  startTime?: string;
  endTime?: string;
};

type ContentGenerationRunsPageViewProps = {
  integrationId: string;
  config: MediapulseHermesDashboardRuntimeConfig;
  searchParams:
    | Promise<ContentGenerationRunsSearchParams>
    | ContentGenerationRunsSearchParams;
};

/**
 * Content-generation runs list for a domain integration diagnostics route.
 */
export const ContentGenerationRunsPageView = async ({
  integrationId,
  config,
  searchParams,
}: ContentGenerationRunsPageViewProps) => {
  if (!config.cgaDiagnosticsEnabled) {
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

  const basePath = `/dashboard/${integrationId}/${CGA_DIAGNOSTICS_PATH_SEGMENT}`;
  const client = createMediapulseAgentDataApiClient(config);
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
      <ContentGenerationRunsTable runs={runs} integrationId={integrationId} />
      <CursorPagination
        basePath={basePath}
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
