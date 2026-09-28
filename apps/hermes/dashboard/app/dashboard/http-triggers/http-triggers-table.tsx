"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Plus, Webhook } from "lucide-react";

import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";

import { DataTable } from "@/components/data-table/data-table";
import { DateTime } from "@/components/date-time/date-time";
import { StatusBadge } from "@/components/status-badge";
import type { ColumnVisibility } from "@/lib/data-table/column-visibility";
import { createDataTableColumnHelper } from "@/lib/data-table/features";
import type { ListUrlState } from "@/lib/data-table/list-url-state";
import type { HttpTriggersPageResult } from "@/lib/http-triggers";

import { HttpTriggerRowActions } from "./http-trigger-row-actions";
import {
  HTTP_TRIGGERS_DEFAULT_COLUMN_VISIBILITY,
  HTTP_TRIGGERS_TABLE_ID,
} from "./http-triggers-table-defaults";

export type HttpTriggerRow = HttpTriggersPageResult["httpTriggers"][number];

type EditHttpTriggerHandler = (httpTriggerId: string) => void;

type CreateHttpTriggerHandler = () => void;

const columnHelper = createDataTableColumnHelper<HttpTriggerRow>();

const createHttpTriggerColumns = (onEdit: EditHttpTriggerHandler) =>
  columnHelper.columns([
    columnHelper.accessor("name", {
      id: "name",
      enableHiding: false,
      meta: { label: "Name", sortKey: "name", mobile: "title" },
      cell: ({ row }) => (
        <Link
          href={`/dashboard/http-triggers/${row.original.id}`}
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          {row.original.name}
        </Link>
      ),
    }),
    columnHelper.accessor("pipeline", {
      id: "pipeline",
      meta: {
        label: "Pipeline",
        mobile: "subtitle",
        cellClassName: "text-muted-foreground",
      },
      cell: ({ row }) => (
        <Link
          href={`/dashboard/pipelines/${row.original.pipeline.id}`}
          className="underline-offset-4 hover:text-foreground hover:underline"
        >
          {row.original.pipeline.name}
        </Link>
      ),
    }),
    columnHelper.accessor("method", {
      id: "method",
      meta: { label: "Method", sortKey: "method", mobile: "field" },
      cell: ({ row }) => (
        <Badge
          variant="outline"
          className="px-1.5 font-mono text-muted-foreground"
        >
          {row.original.method}
        </Badge>
      ),
    }),
    columnHelper.accessor("enabled", {
      id: "status",
      meta: { label: "Status", sortKey: "enabled", mobile: "badge" },
      cell: ({ row }) => (
        <StatusBadge status={row.original.enabled ? "enabled" : "disabled"} />
      ),
    }),
    columnHelper.accessor("lastTriggeredAt", {
      id: "lastTriggered",
      meta: {
        label: "Last triggered",
        mobile: "field",
        cellClassName: "text-muted-foreground",
      },
      cell: ({ row }) =>
        row.original.lastTriggeredAt ? (
          <DateTime value={row.original.lastTriggeredAt} variant="both" />
        ) : (
          "Never"
        ),
    }),
    columnHelper.display({
      id: "actions",
      enableHiding: false,
      meta: {
        label: "Actions",
        mobile: "actions",
        cellClassName: "pr-2 text-right",
      },
      cell: ({ row }) => (
        <HttpTriggerRowActions
          httpTriggerId={row.original.id}
          httpTriggerName={row.original.name}
          method={row.original.method}
          onEdit={onEdit}
        />
      ),
    }),
  ]);

type HttpTriggersTableProps = {
  httpTriggers: HttpTriggerRow[];
  urlState: ListUrlState;
  onEdit: EditHttpTriggerHandler;
  onCreate: CreateHttpTriggerHandler;
  initialColumnVisibility?: ColumnVisibility;
};

export const HttpTriggersTable = ({
  httpTriggers,
  urlState,
  onEdit,
  onCreate,
  initialColumnVisibility = HTTP_TRIGGERS_DEFAULT_COLUMN_VISIBILITY,
}: HttpTriggersTableProps) => {
  const columns = useMemo(() => createHttpTriggerColumns(onEdit), [onEdit]);

  return (
    <DataTable
      tableId={HTTP_TRIGGERS_TABLE_ID}
      columns={columns}
      rows={httpTriggers}
      getRowId={(trigger) => trigger.id}
      urlState={urlState}
      paginationLabel="HTTP triggers list pagination"
      search={{
        label: "Search HTTP triggers by name or description",
        placeholder: "Filter HTTP triggers…",
      }}
      emptyState={{
        icon: Webhook,
        title: "No HTTP triggers yet",
        description:
          "HTTP triggers give a pipeline an authenticated endpoint that other systems can call to start a run.",
        action: (
          <Button type="button" variant="outline" size="sm" onClick={onCreate}>
            <Plus aria-hidden />
            New HTTP trigger
          </Button>
        ),
      }}
      initialColumnVisibility={initialColumnVisibility}
    />
  );
};
