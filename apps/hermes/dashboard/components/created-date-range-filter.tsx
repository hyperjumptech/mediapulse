"use client";

import Link from "next/link";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";

import { useCreatedDateRangeFilter } from "./use-created-date-range-filter";

export type CreatedDateRangeFilterPreserveParams = Record<string, string>;

type CreatedDateRangeFilterProps = {
  /** GET form action (list page base path). */
  basePath: string;
  /** Active lower bound (`from` query param). */
  from?: string;
  /** Active upper bound (`to` query param). */
  to?: string;
  /** Query params to preserve when submitting (sort, search, ticker, page size). */
  preserveParams?: CreatedDateRangeFilterPreserveParams;
  /** When true, renders Filter + Clear inside the form; when false, only date inputs (nested form). */
  showActions?: boolean;
};

/**
 * Reusable created-date range filter using HTML date inputs (`from` / `to` query params).
 * Supports a single day (same from/to), from-only, or to-only bounds.
 */
export const CreatedDateRangeFilter = ({
  basePath,
  from,
  to,
  preserveParams = {},
  showActions = true,
}: CreatedDateRangeFilterProps) => {
  const { hasActiveFilters } = useCreatedDateRangeFilter({ from, to });

  const clearParams = new URLSearchParams();
  for (const [key, value] of Object.entries(preserveParams)) {
    clearParams.set(key, value);
  }
  const clearHref =
    clearParams.toString().length > 0
      ? `${basePath}?${clearParams.toString()}`
      : basePath;

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
      <form
        action={basePath}
        method="get"
        className="flex flex-wrap items-end gap-3"
        role="search"
        aria-label="Filter by created date"
      >
        {Object.entries(preserveParams).map(([key, value]) => (
          <input key={key} type="hidden" name={key} value={value} />
        ))}
        <div className="flex flex-col gap-1">
          <Label htmlFor="filter-created-from" className="text-xs">
            From date
          </Label>
          <Input
            id="filter-created-from"
            type="date"
            name="from"
            defaultValue={from ?? ""}
            className="h-9"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="filter-created-to" className="text-xs">
            To date
          </Label>
          <Input
            id="filter-created-to"
            type="date"
            name="to"
            defaultValue={to ?? ""}
            className="h-9"
          />
        </div>
        {showActions ? (
          <Button type="submit" size="sm">
            Filter
          </Button>
        ) : null}
      </form>
      {showActions && hasActiveFilters ? (
        <div className="flex h-9 shrink-0 items-center">
          <Link
            href={clearHref}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            <span className="underline underline-offset-2 decoration-muted-foreground/40 hover:decoration-foreground">
              Clear dates
            </span>
          </Link>
        </div>
      ) : null}
    </div>
  );
};
