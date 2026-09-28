"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";

import { DataTableCard } from "@/components/data-table/data-table-card";
import {
  ExecutionInvocationCounts,
  ExecutionJobCounts,
  ExecutionTimeLink,
  ExecutionsEmptyState,
  ViewExecutionLink,
} from "@/components/execution-history-cells";
import { HermesExecutionCancelButton } from "@/components/hermes-execution-cancel-button";
import { StatusBadge } from "@/components/status-badge";
import type { HttpTriggerExecutionRow } from "@/lib/http-triggers";

const executionDetailHref = (triggerId: string, executionId: string) =>
  `/dashboard/http-triggers/${triggerId}/executions/${executionId}`;

export const ExecutionsTable = ({
  triggerId,
  executions,
}: {
  triggerId: string;
  executions: HttpTriggerExecutionRow[];
}) => {
  if (executions.length === 0) {
    return (
      <DataTableCard>
        <ExecutionsEmptyState description="Each call to this trigger's invoke URL starts a run that shows up here." />
      </DataTableCard>
    );
  }

  return (
    <DataTableCard>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="pl-4">Started</TableHead>
            <TableHead>Run</TableHead>
            <TableHead className="hidden sm:table-cell">Enqueue</TableHead>
            <TableHead className="hidden text-right md:table-cell">
              Jobs
            </TableHead>
            <TableHead className="text-right">Invocations</TableHead>
            <TableHead className="pr-2">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {executions.map((execution) => {
            const detailHref = executionDetailHref(triggerId, execution.id);
            const cancelTarget = {
              kind: "httpTrigger" as const,
              httpTriggerId: triggerId,
              httpTriggerExecutionId: execution.id,
            };

            return (
              <TableRow key={execution.id}>
                <TableCell className="pl-4">
                  <ExecutionTimeLink
                    href={detailHref}
                    executionTime={execution.executionTime}
                  />
                </TableCell>
                <TableCell>
                  <StatusBadge status={execution.runStatus} />
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <StatusBadge status={execution.enqueueStatus} />
                </TableCell>
                <TableCell className="hidden text-right md:table-cell">
                  <ExecutionJobCounts
                    jobsCreated={execution.jobsCreated}
                    jobsEnqueued={execution.jobsEnqueued}
                  />
                </TableCell>
                <TableCell className="text-right">
                  <ExecutionInvocationCounts
                    succeededInvocationCount={
                      execution.succeededInvocationCount
                    }
                    failedInvocationCount={execution.failedInvocationCount}
                  />
                </TableCell>
                <TableCell className="pr-2">
                  <div className="flex items-center justify-end gap-1">
                    <HermesExecutionCancelButton
                      target={cancelTarget}
                      runStatus={execution.runStatus}
                    />
                    <ViewExecutionLink href={detailHref} />
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </DataTableCard>
  );
};
