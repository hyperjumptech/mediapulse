"use client";

import { ListOrdered } from "lucide-react";

import { DataTable } from "@/components/data-table/data-table";
import { StatusBadge } from "@/components/status-badge";
import { createDataTableColumnHelper } from "@/lib/data-table/features";
import type { StepExecutionSummary } from "@/lib/execution-summary";

const PIPELINE_STEPS_TABLE_ID = "execution-pipeline-steps";

const agentLabelFor = (step: StepExecutionSummary) =>
  `${step.agentId}@${step.agentVersion}`;

const FailedCount = ({ count }: { count: number }) => {
  const className =
    count > 0
      ? "font-medium text-destructive dark:text-red-400"
      : "text-muted-foreground";

  return <span className={className}>{count}</span>;
};

const columnHelper = createDataTableColumnHelper<StepExecutionSummary>();

const columns = columnHelper.columns([
  columnHelper.accessor("stepOrder", {
    id: "order",
    enableHiding: false,
    meta: {
      label: "Order",
      mobile: "field",
      headerClassName: "w-16",
      cellClassName: "text-muted-foreground tabular-nums",
    },
    cell: ({ row }) => row.original.stepOrder,
  }),
  columnHelper.accessor(agentLabelFor, {
    id: "agent",
    enableHiding: false,
    meta: { label: "Agent", mobile: "title" },
    cell: ({ row }) => (
      <code className="font-mono text-xs">{agentLabelFor(row.original)}</code>
    ),
  }),
  columnHelper.accessor("rollupStatus", {
    id: "rollup",
    enableHiding: false,
    meta: { label: "Rollup", mobile: "badge" },
    cell: ({ row }) => <StatusBadge status={row.original.rollupStatus} />,
  }),
  columnHelper.accessor("succeededCount", {
    id: "succeeded",
    enableHiding: false,
    meta: {
      label: "OK",
      mobile: "field",
      headerClassName: "text-right",
      cellClassName: "text-right tabular-nums",
    },
    cell: ({ row }) => row.original.succeededCount,
  }),
  columnHelper.accessor("failedCount", {
    id: "failed",
    enableHiding: false,
    meta: {
      label: "Failed",
      mobile: "field",
      headerClassName: "text-right",
      cellClassName: "text-right tabular-nums",
    },
    cell: ({ row }) => <FailedCount count={row.original.failedCount} />,
  }),
  columnHelper.accessor("expectedInvocationCount", {
    id: "expected",
    enableHiding: false,
    meta: {
      label: "Expected",
      mobile: "field",
      headerClassName: "text-right",
      cellClassName: "text-right text-muted-foreground tabular-nums",
    },
    cell: ({ row }) => row.original.expectedInvocationCount,
  }),
]);

export const ExecutionPipelineStepsTable = ({
  steps,
}: {
  steps: StepExecutionSummary[];
}) => (
  <DataTable
    tableId={PIPELINE_STEPS_TABLE_ID}
    columns={columns}
    rows={steps}
    getRowId={(step) => step.pipelineStepId}
    emptyState={{
      icon: ListOrdered,
      title: "No pipeline steps ran",
      description:
        "Nothing was enqueued for this execution, so no step rollups were recorded.",
    }}
  />
);
