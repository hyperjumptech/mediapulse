"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";

type ErrorLogEntry = { message?: string; timestamp?: string };

type ErrorLogModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  errors: unknown;
};

const isErrorLogArray = (value: unknown): value is ErrorLogEntry[] =>
  Array.isArray(value) &&
  value.every(
    (item) =>
      typeof item === "object" &&
      item !== null &&
      ("message" in item || "timestamp" in item),
  );

/**
 * Dialog that shows execution error log. Renders array of { message, timestamp } as a list, or raw JSON otherwise.
 */
export const ErrorLogModal = ({
  open,
  onOpenChange,
  errors,
}: ErrorLogModalProps) => {
  const content =
    errors === null || errors === undefined ? (
      <p className="text-sm text-muted-foreground">No error details.</p>
    ) : isErrorLogArray(errors) ? (
      <ul className="space-y-2 text-sm">
        {errors.map((entry, i) => (
          <li key={i} className="rounded border bg-muted/30 p-2">
            {entry.timestamp != null && (
              <span className="text-muted-foreground block text-xs">
                {String(entry.timestamp)}
              </span>
            )}
            <span className="block wrap-break-word">
              {entry.message ?? "(no message)"}
            </span>
          </li>
        ))}
      </ul>
    ) : (
      <pre className="max-h-[60vh] overflow-auto rounded border bg-muted/30 p-3 text-xs">
        {JSON.stringify(errors, null, 2)}
      </pre>
    );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Error log</DialogTitle>
        </DialogHeader>
        <div className="min-h-0">{content}</div>
      </DialogContent>
    </Dialog>
  );
};
