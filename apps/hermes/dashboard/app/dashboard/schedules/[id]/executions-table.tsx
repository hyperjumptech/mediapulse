"use client";

import { useCallback, useState } from "react";

import Link from "next/link";

import { Button } from "@workspace/ui/components/button";
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

import { ErrorLogModal } from "./error-log-modal";

type ExecutionsTableProps = {
  scheduleId: string;
  executions: ScheduleExecutionRow[];
};

const hasErrors = (errors: unknown): boolean =>
  Array.isArray(errors) ? errors.length > 0 : errors != null;

/**
 * Encapsulates executions table error log modal state.
 */
const useExecutionsTableState = () => {
  const [errorLogOpen, setErrorLogOpen] = useState(false);
  const [selectedErrors, setSelectedErrors] = useState<unknown>(null);

  const openErrorLog = useCallback((errors: unknown) => {
    setSelectedErrors(errors);
    setErrorLogOpen(true);
  }, []);

  const closeErrorLog = useCallback(() => {
    setErrorLogOpen(false);
    setSelectedErrors(null);
  }, []);

  return {
    errorLogOpen,
    selectedErrors,
    openErrorLog,
    closeErrorLog,
  };
};

/**
 * Renders the schedule executions list: enqueue/run status, job counts, link to execution detail.
 */
export const ExecutionsTable = ({
  scheduleId,
  executions,
}: ExecutionsTableProps) => {
  const { errorLogOpen, selectedErrors, openErrorLog, closeErrorLog } =
    useExecutionsTableState();

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow className="border-muted hover:bg-transparent">
              <TableHead className="w-[180px]">Execution time</TableHead>
              <TableHead className="w-[100px]">Enqueue</TableHead>
              <TableHead className="w-[100px]">Run</TableHead>
              <TableHead className="w-[90px]">Jobs</TableHead>
              <TableHead className="w-[110px]">Invocations ✓ / ✗</TableHead>
              <TableHead>Error log</TableHead>
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
              executions.map((execution) => (
                <TableRow key={execution.id}>
                  <TableCell className="text-muted-foreground text-sm">
                    {format(execution.executionTime, "LLL d, yyyy HH:mm:ss")}
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
                    {hasErrors(execution.errors) ? (
                      <Button
                        type="button"
                        variant="link"
                        className="h-auto p-0 text-primary"
                        onClick={() => openErrorLog(execution.errors)}
                      >
                        View log
                      </Button>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/dashboard/schedules/${scheduleId}/executions/${execution.id}`}
                      className="text-sm text-primary underline-offset-4 hover:underline"
                    >
                      View
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <ErrorLogModal
        open={errorLogOpen}
        onOpenChange={(open) => !open && closeErrorLog()}
        errors={selectedErrors}
      />
    </>
  );
};
