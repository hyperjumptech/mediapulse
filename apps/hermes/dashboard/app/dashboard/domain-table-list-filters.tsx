"use client";

import Form from "next/form";
import Link from "next/link";
import { X } from "lucide-react";
import type {
  TableV1ListFilterDefinition,
  TableV1SelectOption,
} from "@hermes/domain-contract";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@workspace/ui/components/native-select";

import { hasActiveDomainTableFilters } from "@/lib/domain-table-list-params";

const FILTER_LABEL_CLASS = "text-xs font-normal text-muted-foreground";

const FILTER_FIELD_CLASS = "flex flex-col gap-1.5";

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

const buildClearFiltersHref = (
  basePath: string,
  preserveParams: Record<string, string>,
) => {
  const clearParams = new URLSearchParams();
  for (const [key, value] of Object.entries(preserveParams)) {
    clearParams.set(key, value);
  }
  const queryString = clearParams.toString();

  return queryString.length > 0 ? `${basePath}?${queryString}` : basePath;
};

const DomainTableListFilterControl = ({
  filter,
  filterOptions,
  filterValues,
}: {
  filter: TableV1ListFilterDefinition;
  filterOptions: Record<string, TableV1SelectOption[]>;
  filterValues: Record<string, string>;
}) => {
  if (filter.ui === "select") {
    const options = resolveSelectOptions(filter, filterOptions);

    return (
      <div className={FILTER_FIELD_CLASS}>
        <Label htmlFor={`filter-${filter.key}`} className={FILTER_LABEL_CLASS}>
          {filter.label}
        </Label>
        <NativeSelect
          id={`filter-${filter.key}`}
          name={filter.key}
          defaultValue={filterValues[filter.key] ?? ""}
          className="min-w-40 bg-background"
        >
          <NativeSelectOption value="">
            {filter.placeholderAll ?? "All"}
          </NativeSelectOption>
          {options.map((option) => (
            <NativeSelectOption key={option.value} value={option.value}>
              {option.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
    );
  }

  if (filter.ui === "boolean-select") {
    return (
      <div className={FILTER_FIELD_CLASS}>
        <Label htmlFor={`filter-${filter.key}`} className={FILTER_LABEL_CLASS}>
          {filter.label}
        </Label>
        <NativeSelect
          id={`filter-${filter.key}`}
          name={filter.key}
          defaultValue={filterValues[filter.key] ?? ""}
          className="min-w-28 bg-background"
        >
          <NativeSelectOption value="">All</NativeSelectOption>
          <NativeSelectOption value="true">Yes</NativeSelectOption>
          <NativeSelectOption value="false">No</NativeSelectOption>
        </NativeSelect>
      </div>
    );
  }

  const fromKey = filter.rangeParams?.from ?? "from";
  const toKey = filter.rangeParams?.to ?? "to";

  return (
    <>
      <div className={FILTER_FIELD_CLASS}>
        <Label htmlFor={`filter-${fromKey}`} className={FILTER_LABEL_CLASS}>
          From date
        </Label>
        <Input
          id={`filter-${fromKey}`}
          type="date"
          name={fromKey}
          defaultValue={filterValues[fromKey] ?? ""}
          className="w-auto bg-background"
        />
      </div>
      <div className={FILTER_FIELD_CLASS}>
        <Label htmlFor={`filter-${toKey}`} className={FILTER_LABEL_CLASS}>
          To date
        </Label>
        <Input
          id={`filter-${toKey}`}
          type="date"
          name={toKey}
          defaultValue={filterValues[toKey] ?? ""}
          className="w-auto bg-background"
        />
      </div>
    </>
  );
};

export const DomainTableListFilters = ({
  basePath,
  listFilters,
  filterOptions = {},
  filterValues,
  preserveParams,
}: DomainTableListFiltersProps) => {
  const hasActiveFilters = hasActiveDomainTableFilters(filterValues);
  const clearHref = buildClearFiltersHref(basePath, preserveParams);

  if (listFilters.length === 0) {
    return null;
  }

  return (
    <Form
      action={basePath}
      className="flex flex-wrap items-end gap-3"
      role="search"
      aria-label="Filter list"
    >
      {Object.entries(preserveParams).map(([key, value]) => (
        <input key={key} type="hidden" name={key} value={value} />
      ))}
      {listFilters.map((filter) => (
        <DomainTableListFilterControl
          key={filter.key}
          filter={filter}
          filterOptions={filterOptions}
          filterValues={filterValues}
        />
      ))}
      <Button type="submit" variant="secondary">
        Apply
      </Button>
      {hasActiveFilters ? (
        <Link
          href={clearHref}
          className="inline-flex h-9 items-center gap-1 rounded-md px-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <X aria-hidden className="size-4" />
          Clear filters
        </Link>
      ) : null}
    </Form>
  );
};
