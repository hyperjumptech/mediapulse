"use client";

import Link from "next/link";
import { Button } from "@workspace/ui/components/button";
import { Label } from "@workspace/ui/components/label";
import { Input } from "@workspace/ui/components/input";

import { useContentGenerationRunsFilters } from "./use-content-generation-runs-filters";

const BASE_PATH = "/dashboard/agents/content-generation-runs";

type ContentGenerationRunsFiltersProps = {
  /** Active outcome filter value. */
  outcome?: string;
  /** Active tickerId filter value. */
  tickerId?: string;
  /** Active startTime filter value. */
  startTime?: string;
  /** Active endTime filter value. */
  endTime?: string;
};

/**
 * Filter controls for content-generation runs list page.
 * Submits via GET form action to preserve URL params for shareability.
 * Displays a "Clear filters" link when any filter is active.
 *
 * @param props - Component props with active filter values.
 * @returns Form element with filter inputs and clear link.
 */
export const ContentGenerationRunsFilters = ({
  outcome,
  tickerId,
  startTime,
  endTime,
}: ContentGenerationRunsFiltersProps) => {
  const { hasActiveFilters } = useContentGenerationRunsFilters({
    outcome,
    tickerId,
    startTime,
    endTime,
  });

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
      <form
        action={BASE_PATH}
        method="get"
        className="flex w-full max-w-3xl flex-wrap items-end gap-3"
        role="search"
        aria-label="Filter content-generation runs"
      >
        <div className="flex flex-col gap-1">
          <Label htmlFor="filter-outcome" className="text-xs">
            Outcome
          </Label>
          <select
            id="filter-outcome"
            name="outcome"
            defaultValue={outcome ?? ""}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">All</option>
            <option value="success">Success</option>
            <option value="skipped">Skipped</option>
            <option value="failed">Failed</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="filter-ticker-id" className="text-xs">
            Ticker ID
          </Label>
          <Input
            id="filter-ticker-id"
            type="text"
            name="tickerId"
            defaultValue={tickerId ?? ""}
            placeholder="Ticker UUID"
            className="h-9 w-44"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="filter-start-time" className="text-xs">
            Start date
          </Label>
          <Input
            id="filter-start-time"
            type="date"
            name="startTime"
            defaultValue={startTime ?? ""}
            className="h-9"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="filter-end-time" className="text-xs">
            End date
          </Label>
          <Input
            id="filter-end-time"
            type="date"
            name="endTime"
            defaultValue={endTime ?? ""}
            className="h-9"
          />
        </div>
        <Button type="submit" size="sm">
          Filter
        </Button>
      </form>
      {hasActiveFilters && (
        <div className="flex h-9 shrink-0 items-center">
          <Link
            href={BASE_PATH}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            <span className="underline underline-offset-2 decoration-muted-foreground/40 hover:decoration-foreground">
              Clear filters
            </span>
          </Link>
        </div>
      )}
    </div>
  );
};
