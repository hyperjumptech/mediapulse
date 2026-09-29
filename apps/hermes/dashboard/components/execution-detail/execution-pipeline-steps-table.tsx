"use client";

import { ListOrdered } from "lucide-react";

import { DataTable } from "@/components/data-table/data-table";
import { StatusBadge } from "@/components/status-badge";
import { createDataTableColumnHelper } from "@/lib/data-table/features";
import type { StepExecutionSummary } from "@/lib/execution-summary";

const PIPELINE_STEPS_TABLE_ID = "execution-pipeline-steps";

const NUMBER_HEADER_CLASS_NAME = "w-24 text-right";
const NUMBER_CELL_CLASS_NAME = "text-right tabular-nums";

const agentLabelFor = (step: StepExecutionSummary) => {
  const agentLabel = `${step.agentId}@${step.agentVersion}`;
  if (step.sourcePipelineName == null) {
    return agentLabel;
  }

  return `${step.sourcePipelineName} › ${agentLabel}`;
};

const FailedCount = ({ count }: { count: number }) => {
  const className =
    count > 0
      ? "font-medium text-destructive dark:text-red-400"
      : "text-muted-foreground";

  return <span className={className}>{count}</span>;
};

const SucceededOfExpected = ({
  succeededCount,
  expectedInvocationCount,
}: {
  succeededCount: number;
  expectedInvocationCount: number;
}) => (
  <span>
    {succeededCount}
    <span className="text-muted-foreground"> / {expectedInvocationCount}</span>
  </span>
);

const columnHelper = createDataTableColumnHelper<StepExecutionSummary>();

const columns = columnHelper.columns([
  columnHelper.display({
    id: "position",
    enableHiding: false,
    meta: {
      label: "#",
      mobile: "hidden",
      headerClassName: "w-12",
      cellClassName: "text-muted-foreground tabular-nums",
    },
    cell: ({ row }) => row.index + 1,
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
    id: "status",
    enableHiding: false,
    meta: { label: "Status", mobile: "badge", headerClassName: "w-32" },
    cell: ({ row }) => <StatusBadge status={row.original.rollupStatus} />,
  }),
  columnHelper.accessor("succeededCount", {
    id: "succeeded",
    enableHiding: false,
    meta: {
      label: "Succeeded",
      mobile: "field",
      headerClassName: NUMBER_HEADER_CLASS_NAME,
      cellClassName: NUMBER_CELL_CLASS_NAME,
    },
    cell: ({ row }) => (
      <SucceededOfExpected
        succeededCount={row.original.succeededCount}
        expectedInvocationCount={row.original.expectedInvocationCount}
      />
    ),
  }),
  columnHelper.accessor("failedCount", {
    id: "failed",
    enableHiding: false,
    meta: {
      label: "Failed",
      mobile: "field",
      headerClassName: NUMBER_HEADER_CLASS_NAME,
      cellClassName: NUMBER_CELL_CLASS_NAME,
    },
    cell: ({ row }) => <FailedCount count={row.original.failedCount} />,
  }),
]);

export const ExecutionPipelineStepsTable = ({
  steps,
}: {
  steps: StepExecutionSummary[];
}) => (
  <DataTable
    tableId={PIPELINE_STEPS_TABLE_ID}
    title="Pipeline steps"
    count={steps.length}
    columns={columns}
    rows={steps}
    getRowId={(step) => step.pipelineStepId}
    emptyState={{
      icon: ListOrdered,
      title: "No pipeline steps ran",
      description: "Nothing was enqueued for this execution.",
    }}
  />
);
