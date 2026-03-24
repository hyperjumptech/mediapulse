"use client";

import Link from "next/link";
import { format } from "date-fns";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";

import type { PipelineExecutionRow } from "@/lib/pipeline-executions";

type PipelineExecutionsTableProps = {
  pipelineId: string;
  executions: PipelineExecutionRow[];
};

/**
 * Resolves execution detail links by source.
 *
 * @param pipelineId - Pipeline id for manual execution details.
 * @param execution - Row from the merged pipeline execution history.
 * @returns App route to the execution detail page.
 */
const executionDetailHref = (
  pipelineId: string,
  execution: PipelineExecutionRow,
): string => {
  if (execution.source === "schedule") {
    return `/dashboard/schedules/${execution.sourceId}/executions/${execution.id}`;
  }
  if (execution.source === "http-trigger") {
    return `/dashboard/http-triggers/${execution.sourceId}/executions/${execution.id}`;
  }
  return `/dashboard/pipelines/${pipelineId}/executions/${execution.id}`;
};

/**
 * Renders unified executions table for one pipeline.
 */
export const PipelineExecutionsTable = ({
  pipelineId,
  executions,
}: PipelineExecutionsTableProps) => {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow className="border-muted hover:bg-transparent">
            <TableHead className="w-[180px]">Execution time</TableHead>
            <TableHead className="w-[120px]">Source</TableHead>
            <TableHead className="w-[100px]">Enqueue</TableHead>
            <TableHead className="w-[100px]">Run</TableHead>
            <TableHead className="w-[90px]">Jobs</TableHead>
            <TableHead className="min-w-[140px] whitespace-normal">
              Invocations (success / fail)
            </TableHead>
            <TableHead className="w-[90px]">Detail</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {executions.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={7}
                className="text-center text-muted-foreground"
              >
                No executions yet.
              </TableCell>
            </TableRow>
          ) : (
            executions.map((execution) => {
              const href = executionDetailHref(pipelineId, execution);
              const timeLabel = format(
                execution.executionTime,
                "LLL d, yyyy HH:mm:ss",
              );
              return (
                <TableRow key={`${execution.source}:${execution.id}`}>
                  <TableCell className="text-sm">
                    <Link
                      href={href}
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      {timeLabel}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm">{execution.source}</TableCell>
                  <TableCell className="text-sm capitalize">
                    {execution.enqueueStatus}
                  </TableCell>
                  <TableCell className="text-sm capitalize">
                    {execution.runStatus}
                  </TableCell>
                  <TableCell className="text-sm">
                    {execution.jobsCreated} / {execution.jobsEnqueued}
                  </TableCell>
                  <TableCell className="text-sm">
                    {execution.succeededInvocationCount} /{" "}
                    {execution.failedInvocationCount}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={href}
                      className="text-sm text-primary underline-offset-4 hover:underline"
                    >
                      View
                    </Link>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
};
