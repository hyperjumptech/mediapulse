import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

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
import {
  formatManualExecutionMetadataHints,
  getHermesExecutionInvokeTransportBlurb,
} from "@/lib/hermes-execution-invoke-transport";
import { maskExecutionSummaryForDisplay } from "@/lib/mask-json-secrets";
import { getManualPipelineExecutionSummary } from "@/lib/pipeline-executions";
import { withDashboardAdmin } from "@/lib/require-dashboard-admin";

/**
 * Manual pipeline execution detail page.
 */
export default async function PipelineExecutionDetailPage({
  params,
}: {
  params: Promise<{ id: string; executionId: string }>;
}) {
  const { id: pipelineId, executionId } = await params;
  const summary = await withDashboardAdmin(
    getManualPipelineExecutionSummary(pipelineId, executionId),
  );
  if (!summary) notFound();

  const pipelineElapsed = computePipelineWallElapsed(
    summary.invocations,
    summary.execution.runStatus,
  );

  const detail = maskExecutionSummaryForDisplay(summary);
  const invokeTransport =
    getHermesExecutionInvokeTransportBlurb("manual-pipeline");
  const metadataHints = formatManualExecutionMetadataHints(
    detail.execution.metadata,
  );
  const invocationRows = detail.invocations.map((invocation) => ({
    jobId: invocation.jobId,
    status: invocation.status,
    semanticStatus: invocation.semanticStatus,
    outcomeSummary: invocation.outcomeSummary,
    agentId: invocation.agentId,
    startedAtIso: invocation.startedAt?.toISOString() ?? null,
    completedAtIso: invocation.completedAt?.toISOString() ?? null,
    dataQueueAttempts: invocation.dataQueueAttempts,
    dataQueueMaxAttempts: invocation.dataQueueMaxAttempts,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/dashboard/pipelines/${pipelineId}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          Back to pipeline
        </Link>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Execution {detail.execution.id.slice(0, 8)}...
          </h1>
          <p className="text-muted-foreground">{detail.pipeline.name}</p>
        </div>
        <HermesExecutionCancelButton
          target={{
            kind: "manual",
            pipelineId,
            manualExecutionId: executionId,
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
        {metadataHints.length > 0 ? (
          <ul className="list-inside list-disc text-muted-foreground">
            {metadataHints.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : null}
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
                detail.stepExecutions.map((step) => (
                  <TableRow key={step.pipelineStepId}>
                    <TableCell>{step.stepOrder}</TableCell>
                    <TableCell>
                      {step.agentId}@{step.agentVersion}
                    </TableCell>
                    <TableCell className="capitalize">
                      {step.rollupStatus}
                    </TableCell>
                    <TableCell>
                      {step.succeededCount} / {step.failedCount} (expected{" "}
                      {step.expectedInvocationCount})
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-medium">Invocations</h2>
        <ScheduleExecutionInvocationsTable
          invocations={invocationRows}
          payloadSource={{
            kind: "manual",
            parentId: pipelineId,
            executionId,
          }}
        />
      </section>
    </div>
  );
}
