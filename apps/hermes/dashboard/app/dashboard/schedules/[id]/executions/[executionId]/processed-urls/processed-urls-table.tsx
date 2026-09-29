"use client";

import Link from "next/link";
import { useMemo, type ReactNode } from "react";
import { Link2, SearchX } from "lucide-react";

import { Button } from "@workspace/ui/components/button";

import {
  DataTable,
  type DataTableEmptyState,
} from "@/components/data-table/data-table";
import { DateTime } from "@/components/date-time/date-time";
import {
  ToneBadge,
  statusTone,
  type StatusTone,
} from "@/components/status-badge";
import type { ColumnVisibility } from "@/lib/data-table/column-visibility";

import { PROCESSED_URLS_DEFAULT_COLUMN_VISIBILITY } from "./processed-urls-table-defaults";
import { createDataTableColumnHelper } from "@/lib/data-table/features";
import type { ListUrlState } from "@/lib/data-table/list-url-state";
import type { ProcessedUrlItem } from "@/lib/domain-dashboard";

const PROCESSED_URL_STATUS_TONES: Record<string, StatusTone> = {
  collected: "success",
  failed: "failed",
  dropped: "muted",
};

const urlLabelFor = (url: string): string =>
  url.replace(/^https?:\/\/(www\.)?/, "");

const ProcessedUrlStatus = ({ status }: { status: string }) => {
  const tone = PROCESSED_URL_STATUS_TONES[status] ?? statusTone(status);

  return (
    <ToneBadge tone={tone} className="capitalize">
      {status}
    </ToneBadge>
  );
};

const DEFAULT_SUBJECT_TITLE = "Subject";

const columnHelper = createDataTableColumnHelper<ProcessedUrlItem>();

const subjectColumn = (subjectTitle: string) =>
  columnHelper.accessor((item) => item.subject?.label, {
    id: "subject",
    meta: {
      label: subjectTitle,
      mobile: "subtitle",
      cellClassName: "font-mono text-xs",
    },
    cell: ({ getValue }) => getValue() ?? "—",
  });

const detailColumns = columnHelper.columns([
  columnHelper.accessor("url", {
    id: "url",
    enableHiding: false,
    meta: { label: "URL", mobile: "title" },
    cell: ({ row }) => (
      <a
        href={row.original.url}
        target="_blank"
        rel="noopener noreferrer"
        title={row.original.url}
        className="block max-w-xs truncate text-sm underline-offset-4 hover:underline 2xl:max-w-md"
      >
        {urlLabelFor(row.original.url)}
      </a>
    ),
  }),
  columnHelper.accessor("status", {
    id: "status",
    meta: { label: "Status", mobile: "badge" },
    cell: ({ row }) => <ProcessedUrlStatus status={row.original.status} />,
  }),
  columnHelper.accessor((item) => item.reasonDetail ?? item.reason, {
    id: "reason",
    meta: {
      label: "Reason",
      cellClassName:
        "max-w-sm min-w-40 text-xs whitespace-normal text-muted-foreground",
    },
    cell: ({ getValue }) => getValue() ?? "—",
  }),
  columnHelper.accessor("agent", {
    id: "agent",
    meta: {
      label: "Agent",
      hideBelow: "lg",
      cellClassName: "text-xs text-muted-foreground",
    },
    cell: ({ row }) => row.original.agent,
  }),
  columnHelper.accessor("source", {
    id: "source",
    meta: {
      label: "Source",
      cellClassName:
        "max-w-xs text-xs break-all whitespace-normal text-muted-foreground",
    },
    cell: ({ row }) => row.original.source ?? "—",
  }),
  columnHelper.accessor("createdAt", {
    id: "time",
    meta: { label: "Time", cellClassName: "text-xs text-muted-foreground" },
    cell: ({ row }) => <DateTime value={row.original.createdAt} />,
  }),
]);

const createProcessedUrlColumns = (
  subjectTitle: string,
  hasSubjects: boolean,
) =>
  hasSubjects ? [subjectColumn(subjectTitle), ...detailColumns] : detailColumns;

const emptyStateFor = (
  hasActiveFilters: boolean,
  clearFiltersHref: string,
): DataTableEmptyState => {
  if (hasActiveFilters) {
    return {
      icon: SearchX,
      title: "No processed URLs match these filters",
      description: "Try a different agent, status or gate filter.",
      action: (
        <Button variant="outline" size="sm" asChild>
          <Link href={clearFiltersHref}>Clear filters</Link>
        </Button>
      ),
    };
  }

  return {
    icon: Link2,
    title: "No processed URLs",
    description:
      "No processed URL outcomes for this execution. Outcomes are recorded from agent runs triggered after this feature was deployed.",
  };
};

type ProcessedUrlsTableProps = {
  tableId: string;
  items: ProcessedUrlItem[];
  subjectTitle?: string;
  urlState: ListUrlState;
  filters: ReactNode;
  hasActiveFilters: boolean;
  clearFiltersHref: string;
  initialColumnVisibility?: ColumnVisibility;
};

export const ProcessedUrlsTable = ({
  tableId,
  items,
  subjectTitle = DEFAULT_SUBJECT_TITLE,
  urlState,
  filters,
  hasActiveFilters,
  clearFiltersHref,
  initialColumnVisibility = PROCESSED_URLS_DEFAULT_COLUMN_VISIBILITY,
}: ProcessedUrlsTableProps) => {
  const hasSubjects = items.some((item) => item.subject?.label);
  const columns = useMemo(
    () => createProcessedUrlColumns(subjectTitle, hasSubjects),
    [subjectTitle, hasSubjects],
  );

  return (
    <DataTable
      tableId={tableId}
      columns={columns}
      rows={items}
      getRowId={(item) => item.id}
      urlState={urlState}
      paginationLabel="Processed URLs pagination"
      toolbarFilters={filters}
      emptyState={emptyStateFor(hasActiveFilters, clearFiltersHref)}
      initialColumnVisibility={initialColumnVisibility}
    />
  );
};
