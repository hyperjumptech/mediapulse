"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";
import { Button } from "@workspace/ui/components/button";

import {
  useScheduleExecutionInvocationsModal,
  type ScheduleExecutionInvocationRow,
} from "./use-schedule-execution-invocations-modal";

/**
 * Pretty-prints JSON for read-only display in the modal.
 *
 * @param value - Masked input or config object.
 */
const formatJsonBlock = (value: unknown): string => {
  try {
    return JSON.stringify(value ?? null, null, 2);
  } catch {
    return String(value);
  }
};

export type ScheduleExecutionInvocationsTableProps = {
  invocations: ScheduleExecutionInvocationRow[];
};

/**
 * Table of schedule execution invocations; clicking a job id opens a dialog with masked input and config JSON.
 */
export const ScheduleExecutionInvocationsTable = ({
  invocations,
}: ScheduleExecutionInvocationsTableProps) => {
  const { open, selected, openModal, onOpenChange } =
    useScheduleExecutionInvocationsModal();

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Job</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Semantic</TableHead>
              <TableHead>Reason</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invocations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground">
                  No invocations.
                </TableCell>
              </TableRow>
            ) : (
              invocations.map((j) => (
                <TableRow key={j.jobId}>
                  <TableCell className="max-w-[min(100vw,28rem)]">
                    <Button
                      type="button"
                      variant="link"
                      className="h-auto min-h-0 p-0 font-mono text-xs wrap-break-word whitespace-normal text-left"
                      onClick={() => {
                        openModal(j);
                      }}
                    >
                      {j.jobId}
                    </Button>
                  </TableCell>
                  <TableCell className="capitalize">{j.status}</TableCell>
                  <TableCell>{j.semanticStatus ?? "—"}</TableCell>
                  <TableCell className="max-w-md whitespace-normal wrap-break-word text-sm text-muted-foreground">
                    {j.errorSummary ?? "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[85vh] max-w-2xl flex-col gap-4 overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selected
                ? `Invocation ${selected.jobId.slice(0, 8)}…`
                : "Invocation"}
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              Input and config as stored for this job. Values that look like
              credentials are hidden.
            </p>
          </DialogHeader>
          {selected ? (
            <div className="flex flex-col gap-4">
              <div>
                <h3 className="mb-2 text-sm font-medium text-foreground">
                  Input
                </h3>
                <pre className="max-h-48 overflow-auto rounded-md border bg-muted/40 p-3 font-mono text-xs leading-relaxed">
                  {formatJsonBlock(selected.inputMasked)}
                </pre>
              </div>
              <div>
                <h3 className="mb-2 text-sm font-medium text-foreground">
                  Config
                </h3>
                {selected.configMasked == null ? (
                  <p className="text-sm text-muted-foreground">
                    No config stored for this invocation (older executions only
                    saved input).
                  </p>
                ) : (
                  <pre className="max-h-48 overflow-auto rounded-md border bg-muted/40 p-3 font-mono text-xs leading-relaxed">
                    {formatJsonBlock(selected.configMasked)}
                  </pre>
                )}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
};
