"use client";

import Link from "next/link";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";
import { format } from "date-fns";

import type { ScheduleExecutionRow } from "@/lib/schedules";

type ExecutionsTableProps = {
  scheduleId: string;
  executions: ScheduleExecutionRow[];
};

/**
 * Builds the dashboard path for a single schedule execution detail view.
 *
 * @param scheduleId - Owning schedule id.
 * @param executionId - Schedule execution row id.
 * @returns Absolute app path for the execution detail page.
 */
const executionDetailHref = (scheduleId: string, executionId: string) =>
  `/dashboard/schedules/${scheduleId}/executions/${executionId}`;

/**
 * Renders the schedule executions list: enqueue/run status, job counts, and links to execution detail.
 */
export const ExecutionsTable = ({
  scheduleId,
  executions,
}: ExecutionsTableProps) => {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow className="border-muted hover:bg-transparent">
            <TableHead className="w-[180px]">Execution time</TableHead>
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
                colSpan={6}
                className="text-center text-muted-foreground"
              >
                No executions yet.
              </TableCell>
            </TableRow>
          ) : (
            executions.map((execution) => {
              const detailHref = executionDetailHref(scheduleId, execution.id);
              const timeLabel = format(
                execution.executionTime,
                "LLL d, yyyy HH:mm:ss",
              );
              return (
                <TableRow key={execution.id}>
                  <TableCell className="text-sm">
                    <Link
                      href={detailHref}
                      className="text-primary underline-offset-4 hover:underline"
                      aria-label={`Open execution detail for ${timeLabel}`}
                    >
                      {timeLabel}
                    </Link>
                  </TableCell>
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
                      href={detailHref}
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
