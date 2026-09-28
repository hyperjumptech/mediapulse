import { ListOrdered } from "lucide-react";

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";

import { DataTableCard } from "@/components/data-table/data-table-card";
import { StatusBadge } from "@/components/status-badge";
import type { StepExecutionSummary } from "@/lib/execution-summary";

const PipelineStepsEmptyState = () => {
  return (
    <Empty className="gap-4 py-10 md:py-12">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <ListOrdered aria-hidden className="size-5 text-muted-foreground" />
        </EmptyMedia>
        <EmptyTitle className="text-base">No pipeline steps ran</EmptyTitle>
        <EmptyDescription>
          Nothing was enqueued for this execution, so no step rollups were
          recorded.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
};

const PipelineStepRow = ({ step }: { step: StepExecutionSummary }) => {
  const agentLabel = `${step.agentId}@${step.agentVersion}`;
  const failedClassName =
    step.failedCount > 0
      ? "text-right font-medium text-destructive tabular-nums dark:text-red-400"
      : "text-right text-muted-foreground tabular-nums";

  return (
    <TableRow>
      <TableCell className="pl-4 text-muted-foreground tabular-nums">
        {step.stepOrder}
      </TableCell>
      <TableCell>
        <code className="font-mono text-xs">{agentLabel}</code>
      </TableCell>
      <TableCell>
        <StatusBadge status={step.rollupStatus} />
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {step.succeededCount}
      </TableCell>
      <TableCell className={failedClassName}>{step.failedCount}</TableCell>
      <TableCell className="pr-4 text-right text-muted-foreground tabular-nums">
        {step.expectedInvocationCount}
      </TableCell>
    </TableRow>
  );
};

export const ExecutionPipelineStepsTable = ({
  steps,
}: {
  steps: StepExecutionSummary[];
}) => {
  if (steps.length === 0) {
    return (
      <DataTableCard>
        <PipelineStepsEmptyState />
      </DataTableCard>
    );
  }

  return (
    <DataTableCard>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-16 pl-4">Order</TableHead>
            <TableHead>Agent</TableHead>
            <TableHead>Rollup</TableHead>
            <TableHead className="text-right">OK</TableHead>
            <TableHead className="text-right">Failed</TableHead>
            <TableHead className="pr-4 text-right">Expected</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {steps.map((step) => (
            <PipelineStepRow key={step.pipelineStepId} step={step} />
          ))}
        </TableBody>
      </Table>
    </DataTableCard>
  );
};
