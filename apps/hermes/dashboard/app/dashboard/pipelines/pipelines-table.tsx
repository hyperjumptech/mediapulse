"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Plus, Workflow } from "lucide-react";

import { Button } from "@workspace/ui/components/button";

import { DataTable } from "@/components/data-table/data-table";
import { DateTime } from "@/components/date-time/date-time";
import type { ColumnVisibility } from "@/lib/data-table/column-visibility";
import { createDataTableColumnHelper } from "@/lib/data-table/features";
import type { ListUrlState } from "@/lib/data-table/list-url-state";
import { formatCreatedBy } from "@/lib/format-created-by";
import { getPipelineStatus } from "@/lib/pipeline-status";
import type { PipelineSummary } from "@/lib/pipeline-summaries";

import { PipelineRowActions } from "./pipeline-row-actions";
import { PipelineStatusBadge } from "./pipeline-status-badge";
import {
  PIPELINES_DEFAULT_COLUMN_VISIBILITY,
  PIPELINES_TABLE_ID,
} from "./pipelines-table-defaults";

type EditPipelineHandler = (pipelineId: string) => void;

type CreatePipelineHandler = () => void;

const columnHelper = createDataTableColumnHelper<PipelineSummary>();

const buildPipelineColumns = (onEdit: EditPipelineHandler | undefined) =>
  columnHelper.columns([
    columnHelper.accessor("name", {
      id: "name",
      enableHiding: false,
      meta: { label: "Name", sortKey: "name", mobile: "title" },
      cell: ({ row }) => (
        <Link
          href={`/dashboard/pipelines/${row.original.id}`}
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          {row.original.name}
        </Link>
      ),
    }),
    columnHelper.accessor("description", {
      id: "description",
      meta: {
        label: "Description",
        hideBelow: "lg",
        mobile: "hidden",
        cellClassName: "text-muted-foreground",
      },
      cell: ({ row }) => (
        <div
          className="max-w-xs truncate"
          title={row.original.description ?? undefined}
        >
          {row.original.description?.trim() || "—"}
        </div>
      ),
    }),
    columnHelper.accessor("stepCount", {
      id: "steps",
      meta: {
        label: "Steps",
        mobile: "field",
        headerClassName: "text-right",
        cellClassName: "text-right tabular-nums",
      },
      cell: ({ row }) => row.original.stepCount,
    }),
    columnHelper.accessor("isActive", {
      id: "status",
      meta: { label: "Status", mobile: "badge" },
      cell: ({ row }) => (
        <PipelineStatusBadge
          status={getPipelineStatus(row.original, row.original.validation)}
          warnings={row.original.validation.warnings}
        />
      ),
    }),
    columnHelper.accessor("updatedAt", {
      id: "updated",
      meta: {
        label: "Updated",
        sortKey: "updated",
        cellClassName: "text-muted-foreground",
      },
      cell: ({ row }) => <DateTime value={row.original.updatedAt} />,
    }),
    columnHelper.accessor("createdBy", {
      id: "createdBy",
      meta: { label: "Created by", cellClassName: "text-muted-foreground" },
      cell: ({ row }) =>
        formatCreatedBy(row.original.createdBy, row.original.createdById),
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
        <PipelineRowActions
          pipelineId={row.original.id}
          pipelineName={row.original.name}
          onEdit={onEdit}
        />
      ),
    }),
  ]);

type PipelinesTableProps = {
  pipelines: PipelineSummary[];
  urlState: ListUrlState;
  initialColumnVisibility?: ColumnVisibility;
  onEdit?: EditPipelineHandler;
  onCreate?: CreatePipelineHandler;
};

export const PipelinesTable = ({
  pipelines,
  urlState,
  initialColumnVisibility = PIPELINES_DEFAULT_COLUMN_VISIBILITY,
  onEdit,
  onCreate,
}: PipelinesTableProps) => {
  const columns = useMemo(() => buildPipelineColumns(onEdit), [onEdit]);
  const createAction = onCreate ? (
    <Button type="button" variant="outline" size="sm" onClick={onCreate}>
      <Plus aria-hidden />
      New pipeline
    </Button>
  ) : undefined;

  return (
    <DataTable
      tableId={PIPELINES_TABLE_ID}
      columns={columns}
      rows={pipelines}
      getRowId={(pipeline) => pipeline.id}
      urlState={urlState}
      paginationLabel="Pipelines list pagination"
      search={{
        label: "Search pipelines by name or description",
        placeholder: "Filter pipelines…",
      }}
      emptyState={{
        icon: Workflow,
        title: "No pipelines yet",
        description:
          "A pipeline chains agent steps together. Run it by hand, on a schedule, or from an HTTP trigger.",
        action: createAction,
      }}
      initialColumnVisibility={initialColumnVisibility}
    />
  );
};
