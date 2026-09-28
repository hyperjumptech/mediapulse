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

const FILTER_FIELD_CLASS = "flex items-center gap-1.5";

const FILTER_LABEL_CLASS =
  "text-xs font-normal whitespace-nowrap text-muted-foreground";

const FILTER_SELECT_CLASS = "w-40 bg-background";

type DomainTableListFiltersProps = {
  basePath: string;
  listFilters: TableV1ListFilterDefinition[];
  filterOptions?: Record<string, TableV1SelectOption[]>;
  filterValues: Record<string, string>;
  preserveParams: Record<string, string>;
};

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

const allOptionLabel = (filter: TableV1ListFilterDefinition): string => {
  const placeholder = filter.placeholderAll?.trim();
  if (!placeholder || placeholder.toLowerCase() === "all") {
    return `${filter.label}: All`;
  }

  return placeholder;
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
        <Label htmlFor={`filter-${filter.key}`} className="sr-only">
          {filter.label}
        </Label>
        <NativeSelect
          id={`filter-${filter.key}`}
          name={filter.key}
          size="sm"
          defaultValue={filterValues[filter.key] ?? ""}
          className={FILTER_SELECT_CLASS}
        >
          <NativeSelectOption value="">
            {allOptionLabel(filter)}
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
        <Label htmlFor={`filter-${filter.key}`} className="sr-only">
          {filter.label}
        </Label>
        <NativeSelect
          id={`filter-${filter.key}`}
          name={filter.key}
          size="sm"
          defaultValue={filterValues[filter.key] ?? ""}
          className="w-36 bg-background"
        >
          <NativeSelectOption value="">{`${filter.label}: All`}</NativeSelectOption>
          <NativeSelectOption value="true">Yes</NativeSelectOption>
          <NativeSelectOption value="false">No</NativeSelectOption>
        </NativeSelect>
      </div>
    );
  }

  const fromKey = filter.rangeParams?.from ?? "from";
  const toKey = filter.rangeParams?.to ?? "to";

  return (
    <div role="group" aria-label={filter.label} className={FILTER_FIELD_CLASS}>
      <span aria-hidden className={FILTER_LABEL_CLASS}>
        {filter.label}
      </span>
      <Label htmlFor={`filter-${fromKey}`} className="sr-only">
        {`${filter.label} from`}
      </Label>
      <Input
        id={`filter-${fromKey}`}
        type="date"
        name={fromKey}
        defaultValue={filterValues[fromKey] ?? ""}
        className="h-8 w-36 bg-background"
      />
      <span aria-hidden className="text-xs text-muted-foreground">
        –
      </span>
      <Label htmlFor={`filter-${toKey}`} className="sr-only">
        {`${filter.label} to`}
      </Label>
      <Input
        id={`filter-${toKey}`}
        type="date"
        name={toKey}
        defaultValue={filterValues[toKey] ?? ""}
        className="h-8 w-36 bg-background"
      />
    </div>
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
      className="flex min-w-0 flex-wrap items-center gap-2"
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
      <Button type="submit" variant="outline" size="sm">
        Apply
      </Button>
      {hasActiveFilters ? (
        <Button variant="ghost" size="sm" className="h-8 px-2 lg:px-3" asChild>
          <Link href={clearHref}>
            Clear filters
            <X aria-hidden />
          </Link>
        </Button>
      ) : null}
    </Form>
  );
};
