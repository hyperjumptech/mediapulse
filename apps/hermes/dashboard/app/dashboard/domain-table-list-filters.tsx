"use client";

import Link from "next/link";
import type {
  TableV1ListFilterDefinition,
  TableV1SelectOption,
} from "@hermes/domain-contract";
import { Button } from "@workspace/ui/components/button";
import { Label } from "@workspace/ui/components/label";

import { hasActiveDomainTableFilters } from "@/lib/domain-table-list-params";

type DomainTableListFiltersProps = {
  basePath: string;
  listFilters: TableV1ListFilterDefinition[];
  filterOptions?: Record<string, TableV1SelectOption[]>;
  filterValues: Record<string, string>;
  preserveParams: Record<string, string>;
};

/**
 * Resolves select options for a manifest filter from static options or meta `filterOptions`.
 *
 * @param filter - Manifest filter definition.
 * @param filterOptions - Dynamic options from table-v1 meta.
 * @returns Options for a `select` filter control.
 */
const resolveSelectOptions = (
  filter: TableV1ListFilterDefinition,
  filterOptions: Record<string, TableV1SelectOption[]>,
): TableV1SelectOption[] => {
  if (filter.staticOptions) {
    return filter.staticOptions;
  }
  if (filter.optionsMetaKey) {
    return filterOptions[filter.optionsMetaKey] ?? [];
  }
  return [];
};

/**
 * Manifest-driven list filters for domain table-v1 pages.
 */
export const DomainTableListFilters = ({
  basePath,
  listFilters,
  filterOptions = {},
  filterValues,
  preserveParams,
}: DomainTableListFiltersProps) => {
  const hasActiveFilters = hasActiveDomainTableFilters(filterValues);

  const clearParams = new URLSearchParams();
  for (const [key, value] of Object.entries(preserveParams)) {
    clearParams.set(key, value);
  }
  const clearHref =
    clearParams.toString().length > 0
      ? `${basePath}?${clearParams.toString()}`
      : basePath;

  if (listFilters.length === 0) {
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
        {listFilters.map((filter) => {
          if (filter.ui === "select") {
            const options = resolveSelectOptions(filter, filterOptions);
            return (
              <div key={filter.key} className="flex flex-col gap-1">
                <Label htmlFor={`filter-${filter.key}`} className="text-xs">
                  {filter.label}
                </Label>
                <select
                  id={`filter-${filter.key}`}
                  name={filter.key}
                  defaultValue={filterValues[filter.key] ?? ""}
                  className="h-9 min-w-[12rem] rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">{filter.placeholderAll ?? "All"}</option>
                  {options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            );
          }

          if (filter.ui === "boolean-select") {
            return (
              <div key={filter.key} className="flex flex-col gap-1">
                <Label htmlFor={`filter-${filter.key}`} className="text-xs">
                  {filter.label}
                </Label>
                <select
                  id={`filter-${filter.key}`}
                  name={filter.key}
                  defaultValue={filterValues[filter.key] ?? ""}
                  className="h-9 min-w-[12rem] rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">All</option>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </div>
            );
          }

          const fromKey = filter.rangeParams?.from ?? "from";
          const toKey = filter.rangeParams?.to ?? "to";
          return (
            <div key={filter.key} className="contents">
              <div className="flex flex-col gap-1">
                <Label htmlFor={`filter-${fromKey}`} className="text-xs">
                  From date
                </Label>
                <input
                  id={`filter-${fromKey}`}
                  type="date"
                  name={fromKey}
                  defaultValue={filterValues[fromKey] ?? ""}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor={`filter-${toKey}`} className="text-xs">
                  To date
                </Label>
                <input
                  id={`filter-${toKey}`}
                  type="date"
                  name={toKey}
                  defaultValue={filterValues[toKey] ?? ""}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                />
              </div>
            </div>
          );
        })}
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
