"use client";

import Link from "next/link";
import type {
  TableV1EntityTypeOption,
  TableV1ListFilterKey,
  TableV1TickerOption,
} from "@hermes/domain-contract";
import { Button } from "@workspace/ui/components/button";
import { Label } from "@workspace/ui/components/label";

type DomainTableListFiltersProps = {
  basePath: string;
  listFilters: TableV1ListFilterKey[];
  tickerOptions?: TableV1TickerOption[];
  entityTypeOptions?: TableV1EntityTypeOption[];
  intentOptions?: TableV1EntityTypeOption[];
  sourceOptions?: TableV1EntityTypeOption[];
  tickerId?: string;
  typeId?: string;
  intent?: string;
  source?: string;
  isActive?: string;
  from?: string;
  to?: string;
  preserveParams: Record<string, string>;
};

/**
 * Manifest-driven list filters for domain table-v1 pages (ticker, type, intent, source, active set, created date).
 */
export const DomainTableListFilters = ({
  basePath,
  listFilters,
  tickerOptions = [],
  entityTypeOptions = [],
  intentOptions = [],
  sourceOptions = [],
  tickerId,
  typeId,
  intent,
  source,
  isActive,
  from,
  to,
  preserveParams,
}: DomainTableListFiltersProps) => {
  const showTicker = listFilters.includes("tickerId");
  const showType = listFilters.includes("typeId");
  const showIntent = listFilters.includes("intent");
  const showSource = listFilters.includes("source");
  const showActiveSet = listFilters.includes("isActive");
  const showCreated = listFilters.includes("createdAt");
  const hasActiveFilters =
    Boolean(tickerId) ||
    Boolean(typeId) ||
    Boolean(intent) ||
    Boolean(source) ||
    Boolean(isActive) ||
    Boolean(from) ||
    Boolean(to);

  const clearParams = new URLSearchParams();
  for (const [key, value] of Object.entries(preserveParams)) {
    clearParams.set(key, value);
  }
  const clearHref =
    clearParams.toString().length > 0
      ? `${basePath}?${clearParams.toString()}`
      : basePath;

  if (
    !showTicker &&
    !showType &&
    !showIntent &&
    !showSource &&
    !showActiveSet &&
    !showCreated
  ) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3">
      <form
        action={basePath}
        method="get"
        className="flex w-full max-w-4xl flex-wrap items-end gap-3"
        role="search"
        aria-label="Filter list"
      >
        {Object.entries(preserveParams).map(([key, value]) => (
          <input key={key} type="hidden" name={key} value={value} />
        ))}
        {showTicker ? (
          <div className="flex flex-col gap-1">
            <Label htmlFor="filter-ticker-id" className="text-xs">
              Ticker
            </Label>
            <select
              id="filter-ticker-id"
              name="tickerId"
              defaultValue={tickerId ?? ""}
              className="h-9 min-w-[12rem] rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">All tickers</option>
              {tickerOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        {showType ? (
          <div className="flex flex-col gap-1">
            <Label htmlFor="filter-type-id" className="text-xs">
              Type
            </Label>
            <select
              id="filter-type-id"
              name="typeId"
              defaultValue={typeId ?? ""}
              className="h-9 min-w-[12rem] rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">All types</option>
              {entityTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        {showActiveSet ? (
          <div className="flex flex-col gap-1">
            <Label htmlFor="filter-is-active" className="text-xs">
              Active set
            </Label>
            <select
              id="filter-is-active"
              name="isActive"
              defaultValue={isActive ?? ""}
              className="h-9 min-w-[12rem] rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">All</option>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </div>
        ) : null}
        {showIntent ? (
          <div className="flex flex-col gap-1">
            <Label htmlFor="filter-intent" className="text-xs">
              Intent
            </Label>
            <select
              id="filter-intent"
              name="intent"
              defaultValue={intent ?? ""}
              className="h-9 min-w-[12rem] rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">All intents</option>
              {intentOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        {showSource ? (
          <div className="flex flex-col gap-1">
            <Label htmlFor="filter-source" className="text-xs">
              Source
            </Label>
            <select
              id="filter-source"
              name="source"
              defaultValue={source ?? ""}
              className="h-9 min-w-[12rem] rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">All sources</option>
              {sourceOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        {showCreated ? (
          <>
            <div className="flex flex-col gap-1">
              <Label htmlFor="filter-created-from" className="text-xs">
                From date
              </Label>
              <input
                id="filter-created-from"
                type="date"
                name="from"
                defaultValue={from ?? ""}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="filter-created-to" className="text-xs">
                To date
              </Label>
              <input
                id="filter-created-to"
                type="date"
                name="to"
                defaultValue={to ?? ""}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              />
            </div>
          </>
        ) : null}
        <Button type="submit" size="sm">
          Filter
        </Button>
      </form>
      {hasActiveFilters ? (
        <Link
          href={clearHref}
          className="text-sm text-muted-foreground hover:text-foreground w-fit"
        >
          <span className="underline underline-offset-2 decoration-muted-foreground/40 hover:decoration-foreground">
            Clear filters
          </span>
        </Link>
      ) : null}
    </div>
  );
};
