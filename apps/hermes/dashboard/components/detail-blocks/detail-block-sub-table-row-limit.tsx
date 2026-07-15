"use client";

import { useState } from "react";

import type {
  DetailBlockSectionRule,
  DetailBlockSubTableColumn,
} from "@hermes/domain-contract";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";

import { DetailBlockSectionHeader } from "./detail-block-section-header";
import { DetailBlockSubTableContent } from "./detail-block-sub-table";

const ALL_VALUE = "all";

/**
 * Renders a sub-table section with a row-count selector (the given options plus "All") at the right
 * of the header. The first option is the default, so the table starts limited to that many rows.
 */
export const DetailBlockSubTableRowLimit = ({
  label,
  sectionRule,
  data,
  columns,
  rows,
  rowContext,
  emptyState,
  hideHeader,
  options,
}: {
  label?: string;
  sectionRule?: DetailBlockSectionRule;
  data: unknown;
  columns: readonly DetailBlockSubTableColumn[];
  rows: readonly Record<string, unknown>[];
  rowContext: unknown;
  emptyState?: string;
  hideHeader?: boolean;
  options: readonly number[];
}) => {
  const [value, setValue] = useState<string>(String(options[0]));
  const limit = value === ALL_VALUE ? rows.length : Number(value);
  const visibleRows = rows.slice(0, limit);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <DetailBlockSectionHeader
          label={label}
          sectionRule={sectionRule}
          data={data}
        />
        <Select value={value} onValueChange={setValue}>
          <SelectTrigger className="h-8 w-[5.5rem] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option} value={String(option)}>
                {option}
              </SelectItem>
            ))}
            <SelectItem value={ALL_VALUE}>All</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {emptyState ?? "No items."}
        </p>
      ) : (
        <DetailBlockSubTableContent
          columns={columns}
          rows={visibleRows}
          rowContext={rowContext}
          hideHeader={hideHeader}
        />
      )}
    </section>
  );
};
