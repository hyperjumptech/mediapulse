"use client";

import Link from "next/link";

import type { PipelineUsageSummary } from "@/lib/pipeline-usage";

type PipelineUsageListProps = {
  usages: PipelineUsageSummary[];
  emptyMessage: string;
  ariaLabel: string;
};

/**
 * Renders a linked list of pipelines that reference a variable/expansion.
 *
 * @param props - Usage rows and copy for accessibility/empty state.
 * @returns Linked usage list with match metadata.
 */
export const PipelineUsageList = ({
  usages,
  emptyMessage,
  ariaLabel,
}: PipelineUsageListProps) => {
  if (usages.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <ul className="space-y-2" aria-label={ariaLabel}>
      {usages.map((usage) => (
        <li key={usage.id} className="rounded-md border p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/dashboard/pipelines/${encodeURIComponent(usage.id)}`}
              className="text-sm font-medium text-primary underline underline-offset-4 hover:no-underline"
            >
              {usage.name}
            </Link>
            <span className="text-xs text-muted-foreground">
              {usage.matchCount} match{usage.matchCount === 1 ? "" : "es"}
            </span>
            {usage.matchedStepIds.length > 0 ? (
              <span className="text-xs text-muted-foreground">
                {usage.matchedStepIds.length} step
                {usage.matchedStepIds.length === 1 ? "" : "s"}
              </span>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
};
