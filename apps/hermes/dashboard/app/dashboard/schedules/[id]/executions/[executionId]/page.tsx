import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, GitBranch } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";

import { HermesExecutionCancelButton } from "@/components/hermes-execution-cancel-button";
import { EnqueueDiagnosticsPanel } from "@/components/enqueue-diagnostics";
import { ScheduleExecutionInvocationsTable } from "@/components/schedule-execution-invocations-table";
import {
  computePipelineWallElapsed,
  formatPipelineElapsedLabel,
} from "@/lib/compute-execution-elapsed";
import { formatInvocationOutcomeSummary } from "@/lib/format-invocation-outcome-summary";
import { getHermesExecutionInvokeTransportBlurb } from "@/lib/hermes-execution-invoke-transport";
import { maskScheduleExecutionDetailForDisplay } from "@/lib/mask-json-secrets";
import { getScheduleExecutionDetail } from "@/lib/schedules";

type PageProps = {
  params: Promise<{ id: string; executionId: string }>;
};

/**
 * Schedule execution detail: dual-phase status, step rollups, and per-invocation outcomes.
 */
export default async function ScheduleExecutionDetailPage({
  params,
}: PageProps) {
  const { id: scheduleId, executionId } = await params;
  const rawDetail = await getScheduleExecutionDetail(scheduleId, executionId);
  if (!rawDetail) {
    notFound();
  }
  const pipelineElapsed = computePipelineWallElapsed(
    rawDetail.invocations.map((job) => ({
      enqueuedAt: job.enqueuedAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
    })),
    rawDetail.execution.runStatus,
  );
  const detail = maskScheduleExecutionDetailForDisplay(rawDetail);
  const invokeTransport = getHermesExecutionInvokeTransportBlurb("schedule");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/dashboard/schedules/${scheduleId}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          Back to schedule
        </Link>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="break-all text-2xl font-semibold text-foreground">
            Execution {detail.execution.id}
          </h1>
          <p className="text-muted-foreground">
            {detail.schedule.name}
            {detail.pipeline ? (
              <>
                {" · "}
                <Link
                  href={`/dashboard/pipelines/${detail.pipeline.id}`}
                  className="inline-flex items-center gap-1 underline-offset-4 hover:text-foreground hover:underline"
                >
                  <GitBranch className="size-4 shrink-0" aria-hidden />
                  {detail.pipeline.name}
                </Link>
              </>
            ) : null}
          </p>
        </div>
        <HermesExecutionCancelButton
          target={{
            kind: "schedule",
            scheduleId,
            scheduleExecutionId: executionId,
          }}
          runStatus={detail.execution.runStatus}
        />
      </div>

      <section className="grid gap-2 text-sm">
        <p>
          <span className="text-muted-foreground">Enqueue status:</span>{" "}
          {detail.execution.enqueueStatus}
        </p>
        <p>
          <span className="text-muted-foreground">Run status:</span>{" "}
          {detail.execution.runStatus}
        </p>
        <p>
          <span className="text-muted-foreground">Elapsed:</span>{" "}
          {formatPipelineElapsedLabel(pipelineElapsed)}
        </p>
        <p>
          <span className="text-muted-foreground">
            Jobs created / enqueued:
          </span>{" "}
          {detail.execution.jobsCreated} / {detail.execution.jobsEnqueued}
        </p>
        <p>
          <span className="text-muted-foreground">
            Invocations succeeded / failed:
          </span>{" "}
          {detail.execution.succeededInvocationCount} /{" "}
          {detail.execution.failedInvocationCount}
        </p>
        <p>
          <span className="text-muted-foreground">Invocation transport:</span>{" "}
          {invokeTransport.headline}
        </p>
        <p className="text-muted-foreground">{invokeTransport.detail}</p>
      </section>

      <EnqueueDiagnosticsPanel
        enqueueStatus={detail.execution.enqueueStatus}
        errors={detail.execution.errors}
        metadata={detail.execution.metadata}
      />

      <section>
        <h2 className="mb-2 text-lg font-medium">Pipeline steps</h2>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Agent</TableHead>
                <TableHead>Rollup</TableHead>
                <TableHead>OK / Fail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detail.stepExecutions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground">
                    No step rows (nothing was enqueued).
                  </TableCell>
                </TableRow>
              ) : (
                detail.stepExecutions.map((s) => (
                  <TableRow key={s.pipelineStepId}>
                    <TableCell>{s.stepOrder}</TableCell>
                    <TableCell>
                      {s.agentId}@{s.agentVersion}
                    </TableCell>
                    <TableCell className="capitalize">
                      {s.rollupStatus}
                    </TableCell>
                    <TableCell>
                      {s.succeededCount} / {s.failedCount} (expected{" "}
                      {s.expectedInvocationCount})
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <div>
        <Link
          href={`/dashboard/schedules/${scheduleId}/executions/${executionId}/processed-urls`}
          className="text-sm underline-offset-4 hover:underline"
        >
          View Processed URLs →
        </Link>
      </div>

      <section>
        <h2 className="mb-2 text-lg font-medium">Invocations</h2>
        <ScheduleExecutionInvocationsTable
          invocations={detail.invocations.map((j) => ({
            jobId: j.jobId,
            status: j.status,
            semanticStatus: j.semanticStatus,
            outcomeSummary:
              formatInvocationOutcomeSummary(j.error, j.agentResponse) ?? null,
            transportError: j.error,
            agentResponse: j.agentResponse,
            inputMasked: j.params,
            configMasked: j.invocationConfig,
            agentId: j.agentId,
            startedAtIso: j.startedAt?.toISOString() ?? null,
            completedAtIso: j.completedAt?.toISOString() ?? null,
            dataQueueAttempts: j.dataQueueAttempts,
            dataQueueMaxAttempts: j.dataQueueMaxAttempts,
          }))}
        />
      </section>
    </div>
  );
}
