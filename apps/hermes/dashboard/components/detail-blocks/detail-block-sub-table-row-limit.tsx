"use client";

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

import { DetailBlockEmptyState } from "./detail-block-empty-state";
import { DetailBlockSectionHeader } from "./detail-block-section-header";
import { DetailBlockSubTableContent } from "./detail-block-sub-table";
import { ALL_ROWS_VALUE, useSubTableRowLimit } from "./use-sub-table-row-limit";

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
  defaultAll,
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
  defaultAll?: boolean;
}) => {
  const { value, setValue, visibleRows } = useSubTableRowLimit({
    rows,
    options,
    defaultAll,
  });

  return (
    <section className="flex min-w-0 flex-col gap-4">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <DetailBlockSectionHeader
          label={label}
          sectionRule={sectionRule}
          data={data}
        />
        <Select value={value} onValueChange={setValue}>
          <SelectTrigger className="ml-auto h-8 w-auto min-w-20 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option} value={String(option)}>
                {option}
              </SelectItem>
            ))}
            <SelectItem value={ALL_ROWS_VALUE}>All</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {rows.length === 0 ? (
        <DetailBlockEmptyState message={emptyState ?? "No items."} />
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
