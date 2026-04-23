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
import { HermesExecutionCancelButton } from "@/components/hermes-execution-cancel-button";
import type { HttpTriggerExecutionRow } from "@/lib/http-triggers";

const executionDetailHref = (triggerId: string, executionId: string) =>
  `/dashboard/http-triggers/${triggerId}/executions/${executionId}`;

/**
 * Execution history table for one HTTP trigger.
 */
export const ExecutionsTable = ({
  triggerId,
  executions,
}: {
  triggerId: string;
  executions: HttpTriggerExecutionRow[];
}) => {
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
            <TableHead className="w-[120px]">Actions</TableHead>
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
              const href = executionDetailHref(triggerId, execution.id);
              const timeLabel = format(
                execution.executionTime,
                "LLL d, yyyy HH:mm:ss",
              );
              return (
                <TableRow key={execution.id}>
                  <TableCell className="text-sm">
                    <Link
                      href={href}
                      className="text-primary underline-offset-4 hover:underline"
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
                      href={href}
                      className="text-sm text-primary underline-offset-4 hover:underline"
                    >
                      View
                    </Link>
                  </TableCell>
                  <TableCell>
                    <HermesExecutionCancelButton
                      target={{
                        kind: "httpTrigger",
                        httpTriggerId: triggerId,
                        httpTriggerExecutionId: execution.id,
                      }}
                      runStatus={execution.runStatus}
                    />
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
