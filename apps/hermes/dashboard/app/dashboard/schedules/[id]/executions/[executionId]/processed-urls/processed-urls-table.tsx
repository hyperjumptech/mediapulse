"use client";

import Link from "next/link";
import type { ReactNode } from "react";
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
import { createDataTableColumnHelper } from "@/lib/data-table/features";
import type { ListUrlState } from "@/lib/data-table/list-url-state";
import type { ProcessedUrlItem } from "@/lib/domain-dashboard";

const PROCESSED_URL_STATUS_TONES: Record<string, StatusTone> = {
  collected: "success",
  failed: "failed",
  dropped: "muted",
};

const MAX_URL_LABEL_LENGTH = 80;

const truncateUrl = (url: string): string =>
  url.length > MAX_URL_LABEL_LENGTH
    ? `${url.slice(0, MAX_URL_LABEL_LENGTH)}…`
    : url;

const ProcessedUrlStatus = ({ status }: { status: string }) => {
  const tone = PROCESSED_URL_STATUS_TONES[status] ?? statusTone(status);

  return (
    <ToneBadge tone={tone} className="capitalize">
      {status}
    </ToneBadge>
  );
};

const columnHelper = createDataTableColumnHelper<ProcessedUrlItem>();

const columns = columnHelper.columns([
  columnHelper.accessor("tickerSymbol", {
    id: "ticker",
    meta: {
      label: "Ticker",
      mobile: "subtitle",
      cellClassName: "font-mono text-xs",
    },
    cell: ({ row }) => row.original.tickerSymbol,
  }),
  columnHelper.accessor("agent", {
    id: "agent",
    meta: {
      label: "Agent",
      cellClassName: "text-xs text-muted-foreground",
    },
    cell: ({ row }) => row.original.agent,
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
      cellClassName: "max-w-xs text-xs whitespace-normal text-muted-foreground",
    },
    cell: ({ getValue }) => getValue() ?? "—",
  }),
  columnHelper.accessor("url", {
    id: "url",
    enableHiding: false,
    meta: {
      label: "URL",
      mobile: "title",
      cellClassName: "max-w-sm text-xs break-all whitespace-normal",
    },
    cell: ({ row }) => (
      <a
        href={row.original.url}
        target="_blank"
        rel="noopener noreferrer"
        className="underline-offset-4 hover:underline"
      >
        {truncateUrl(row.original.url)}
      </a>
    ),
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
  urlState: ListUrlState;
  filters: ReactNode;
  hasActiveFilters: boolean;
  clearFiltersHref: string;
  initialColumnVisibility?: ColumnVisibility;
};

export const ProcessedUrlsTable = ({
  tableId,
  items,
  urlState,
  filters,
  hasActiveFilters,
  clearFiltersHref,
  initialColumnVisibility,
}: ProcessedUrlsTableProps) => (
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
