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
import { ScheduleExecutionInvocationsTable } from "@/components/schedule-execution-invocations-table";
import {
  computePipelineWallElapsed,
  formatPipelineElapsedLabel,
} from "@/lib/compute-execution-elapsed";
import { formatInvocationErrorSummary } from "@/lib/format-invocation-error";
import { getHttpTriggerExecutionDetail } from "@/lib/http-triggers";
import { maskSecretsInJson } from "@/lib/mask-json-secrets";

/**
 * HTTP trigger execution detail page.
 */
export default async function HttpTriggerExecutionDetailPage({
  params,
}: {
  params: Promise<{ id: string; executionId: string }>;
}) {
  const { id: triggerId, executionId } = await params;
  const rawDetail = await getHttpTriggerExecutionDetail(triggerId, executionId);
  if (!rawDetail) notFound();

  const pipelineElapsed = computePipelineWallElapsed(
    rawDetail.invocations.map((job) => ({
      enqueuedAt: job.enqueuedAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
    })),
    rawDetail.execution.runStatus,
  );

  const detail = {
    ...rawDetail,
    invocations: rawDetail.invocations.map((invocation) => ({
      ...invocation,
      params: maskSecretsInJson(invocation.params),
      invocationConfig:
        invocation.invocationConfig == null
          ? null
          : maskSecretsInJson(invocation.invocationConfig),
    })),
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/dashboard/http-triggers/${triggerId}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          Back to HTTP trigger
        </Link>
      </div>
      <div>
        <h1 className="break-all text-2xl font-semibold text-foreground">
          Execution {detail.execution.id}
        </h1>
        <p className="text-muted-foreground">
          {detail.trigger.name}
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
      </section>

      {detail.execution.metadata != null ? (
        <section>
          <h2 className="mb-2 text-lg font-medium">Request snapshot</h2>
          <pre className="max-h-[32rem] overflow-auto rounded-md border bg-muted p-4 font-mono text-xs">
            {JSON.stringify(
              maskSecretsInJson(detail.execution.metadata),
              null,
              2,
            )}
          </pre>
        </section>
      ) : null}

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
          invocations={detail.invocations.map((job) => ({
            jobId: job.jobId,
            status: job.status,
            semanticStatus: job.semanticStatus,
            errorSummary: formatInvocationErrorSummary(job.error) ?? null,
            inputMasked: job.params,
            configMasked: job.invocationConfig,
            agentId: job.agentId,
            startedAtIso: job.startedAt?.toISOString() ?? null,
            completedAtIso: job.completedAt?.toISOString() ?? null,
            dataQueueAttempts: job.dataQueueAttempts,
            dataQueueMaxAttempts: job.dataQueueMaxAttempts,
          }))}
        />
      </section>
    </div>
  );
}
