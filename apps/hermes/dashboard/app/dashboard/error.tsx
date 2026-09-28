"use client";

import { AlertTriangle } from "lucide-react";

import { Button } from "@workspace/ui/components/button";

import { useReportError } from "@/hooks/use-report-error";

export default function DashboardError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useReportError(error);

  return (
    <div className="flex flex-col items-start gap-4 rounded-lg border border-destructive/30 bg-destructive/5 p-6">
      <div className="flex items-center gap-2 text-destructive">
        <AlertTriangle className="size-5" aria-hidden />
        <h2 className="text-base font-semibold">This page failed to load</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        {error.digest
          ? `Something went wrong on the server (reference ${error.digest}).`
          : error.message || "Something went wrong."}
      </p>
      <Button variant="outline" size="sm" onClick={() => unstable_retry()}>
        Try again
      </Button>
    </div>
  );
}
