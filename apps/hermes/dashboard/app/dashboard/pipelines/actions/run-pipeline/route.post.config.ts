import { randomUUID } from "node:crypto";
import { env } from "@hermes/env";
import { headers } from "next/headers";
import {
  AgentJobExecutionStatus,
  prisma as orchestrationPrisma,
  Prisma,
  ScheduleEnqueueStatus,
  ScheduleRunStatus,
  ScheduleStepRollupStatus,
} from "@hermes/orchestration-database";
import {
  diagnosticFromCaughtError,
  mergeExecutionConfig,
  planPipelineInvocations,
  type EnqueueDiagnosticEntry,
  type EnqueueInvokeAgentItem,
  type ExpandStepInputs,
} from "@hermes/scheduler";
import { mergeHermesEnqueueCorrelationIntoMetadata } from "@hermes/scheduler/enqueue-diagnostics-correlation";
import { batchDepRef } from "@nicnocquee/dataqueue";
import {
  createRequestValidator,
  errorResponse,
  type HandlerFunc,
  successResponse,
} from "route-action-gen/lib";
import { z } from "zod";

import { requireDashboardSessionForRoute } from "@/lib/auth-dashboard";
import { createExpandStepInputsForManualPipelineRun } from "@/lib/expand-step-inputs-for-manual-pipeline";
import { getHermesJobQueue } from "@/lib/hermes-job-queue";
import { validatePipeline } from "@/lib/validate-pipeline";

const bodyValidator = z.object({
  pipelineId: z.string().uuid(),
});

/** Prefix for server logs when debugging Run pipeline in Docker or `pnpm dev` output. */
const RUN_PIPELINE_LOG_PREFIX = "[hermes-dashboard:run-pipeline]";

/**
 * Fallback per-agent request timeout (ms) when the pipeline row has no `timeout`.
 * Matches Hermes worker `defaultTimeoutMs` (see `apps/hermes/worker/src/job-handlers.ts`).
 */
const MANUAL_INVOKE_AGENT_REQUEST_TIMEOUT_MS = 300_000;

/**
 * Logs run-pipeline diagnostics to stderr (visible in dashboard server logs).
 *
 * @param phase - Stage that failed or produced a warning (e.g. token, planning, agent-http).
 * @param pipelineId - Pipeline id when known; use undefined before load.
 * @param message - Short summary.
 * @param extra - Optional structured fields (job id, status code, planning errors).
 * @param err - Optional thrown value for stack/details.
 */
const logRunPipelineIssue = (
  phase: string,
  pipelineId: string | undefined,
  message: string,
  extra?: Record<string, unknown>,
  err?: unknown,
): void => {
  const base = {
    phase,
    pipelineId: pipelineId ?? null,
    ...extra,
  };
  if (err !== undefined) {
    console.error(RUN_PIPELINE_LOG_PREFIX, message, base, err);
  } else {
    console.error(RUN_PIPELINE_LOG_PREFIX, message, base);
  }
};

export const requestValidator = createRequestValidator({
  body: bodyValidator,
  user: requireDashboardSessionForRoute,
});

export const responseValidator = z.object({
  ok: z.literal(true),
  invocationsRun: z.number(),
  executionId: z.string().uuid(),
  runStatus: z.enum(["running", "succeeded", "partial", "failed", "cancelled"]),
  failedInvocationCount: z.number(),
});

/** Optional HTTP status when normalizing a non-OK agent response. */
export type DetailFromAgentErrorContext = {
  statusCode?: number;
};

const isGatewayStatusCode = (code: number | undefined): boolean =>
  code === 502 || code === 503 || code === 504;

const upgradeUnknownDetailForGateway = (
  detail: string,
  statusCode: number | undefined,
): string => {
  if (!isGatewayStatusCode(statusCode)) return detail;
  const isUnknownEmpty =
    detail === "Unknown error (empty response body)" ||
    detail === "Unknown error (see agent logs)";
  if (!isUnknownEmpty) return detail;
  return "Bad gateway or upstream error with an empty or non-JSON body. Often this is a reverse proxy or load balancer timing out or resetting the connection to the agent; check upstream idle limits and agent health (for scheduled runs, also confirm the worker-to-agent path, not only DataQueue).";
};

/**
 * Builds a short human-readable detail from an agent error response body (JSON object or string).
 *
 * @param body - Parsed or raw body from `got` when `throwHttpErrors` is false.
 * @param context - When `statusCode` is 502/503/504 and the body is empty, adds an operator hint for proxy timeouts.
 */
export const detailFromAgentErrorBody = (
  body: unknown,
  context?: DetailFromAgentErrorContext,
): string => {
  let detail: string;
  if (body === null || body === undefined) {
    detail = "Unknown error (empty response body)";
  } else if (typeof body === "string") {
    const trimmed = body.trim();
    if (!trimmed) {
      detail = "Unknown error (empty response body)";
    } else {
      try {
        const parsed = JSON.parse(trimmed) as { message?: unknown };
        if (typeof parsed.message === "string" && parsed.message.length > 0) {
          detail = parsed.message;
        } else {
          detail =
            trimmed.length > 300 ? `${trimmed.slice(0, 300)}...` : trimmed;
        }
      } catch {
        detail = trimmed.length > 300 ? `${trimmed.slice(0, 300)}...` : trimmed;
      }
    }
  } else if (typeof body === "object" && !Array.isArray(body)) {
    const msg = (body as { message?: unknown }).message;
    detail =
      typeof msg === "string" && msg.length > 0
        ? msg
        : "Unknown error (see agent logs)";
  } else {
    detail = "Unknown error (see agent logs)";
  }
  return upgradeUnknownDetailForGateway(detail, context?.statusCode);
};

/**
 * Normalizes a `got` response body to a string for {@link parseAgentResponseEnvelope}.
 *
 * @param body - Raw string, parsed JSON, or nullish from `throwHttpErrors: false` responses.
 */
export const agentHttpBodyToRawString = (
  body: unknown,
): { raw: string; isEmpty: boolean } => {
  if (body === null || body === undefined) {
    return { raw: "", isEmpty: true };
  }
  if (typeof body === "string") {
    const trimmed = body.trim();
    return { raw: body, isEmpty: trimmed === "" };
  }
  return { raw: JSON.stringify(body), isEmpty: false };
};

/**
 * Enqueues manual pipeline `invoke_agent` jobs on Hermes DataQueue (same pattern as HTTP trigger runs).
 *
 * @param items - Planned invocations with optional same-batch `dependsOn` indices.
 */
const defaultEnqueueManualAgentInvocations = async (
  items: EnqueueInvokeAgentItem[],
): Promise<void> => {
  if (items.length === 0) {
    return;
  }
  const jobQueue = getHermesJobQueue();
  const jobDefs = items.map((item) => ({
    jobType: "invoke_agent" as const,
    payload: item.payload,
    priority: item.payload.priority,
    idempotencyKey: item.payload.jobId,
    dependsOn:
      item.dependsOnBatchIndices && item.dependsOnBatchIndices.length > 0
        ? {
            jobIds: item.dependsOnBatchIndices.map((idx) => batchDepRef(idx)),
          }
        : undefined,
    tags: [
      `manualPipelineExecution:${item.payload.manualExecutionId}`,
      `pipeline:${item.payload.pipelineId}`,
      `pipelineStep:${item.payload.pipelineStepId}`,
    ],
  }));
  const insertedIds = await jobQueue.addJobs(jobDefs);
  for (let idx = 0; idx < insertedIds.length; idx++) {
    const queueJobId = insertedIds[idx];
    const item = items[idx];
    if (item === undefined || queueJobId === undefined) {
      continue;
    }
    await jobQueue.editJob(queueJobId, {
      payload: { ...item.payload, hermesDataQueueJobId: queueJobId },
    });
  }
};

type RunPipelineHandlerDependencies = {
  db?: typeof orchestrationPrisma;
  now?: () => Date;
  expandStepInputs?: ExpandStepInputs;
  /** Injected in tests to avoid requiring `PG_DATAQUEUE_DATABASE`. */
  enqueueManualAgentInvocations?: (
    items: EnqueueInvokeAgentItem[],
  ) => Promise<void>;
};

type RunPipelineHandler = HandlerFunc<
  typeof requestValidator,
  typeof responseValidator,
  undefined
>;

/**
 * Plans a manual pipeline run, persists execution rows, and enqueues `invoke_agent` jobs on DataQueue
 * so hermes-worker performs agent HTTP calls (short Server Action; safe to refresh while work continues).
 *
 * @param dependencies - Optional collaborators for tests.
 * @returns Route-action-gen handler for manual run requests.
 */
export const createRunPipelineHandler = ({
  db = orchestrationPrisma,
  now = () => new Date(),
  expandStepInputs = createExpandStepInputsForManualPipelineRun(),
  enqueueManualAgentInvocations = defaultEnqueueManualAgentInvocations,
}: RunPipelineHandlerDependencies = {}): RunPipelineHandler => {
  return async (data) => {
    const pipelineIdRequest = data.body.pipelineId;

    try {
      const session = data.user;

      const incomingHeaders = await headers();
      const headerRequestId = incomingHeaders.get("x-request-id")?.trim();
      const runRequestId =
        headerRequestId != null && headerRequestId !== ""
          ? headerRequestId
          : randomUUID();

      const pipelineFindArgs = {
        where: { id: data.body.pipelineId },
        include: {
          steps: {
            include: { agentConfig: true },
            orderBy: { order: "asc" },
          },
        },
      } satisfies Prisma.PipelineFindUniqueArgs;
      const pipeline = await db.pipeline.findUnique(pipelineFindArgs);
      if (!pipeline) {
        logRunPipelineIssue(
          "load-pipeline",
          pipelineIdRequest,
          "Pipeline not found",
        );
        return errorResponse("Pipeline not found");
      }

      const pipelineValidation = await validatePipeline(
        {
          id: pipeline.id,
          name: pipeline.name,
          domainIntegrationId: pipeline.domainIntegrationId,
          steps: pipeline.steps.map((step) => ({
            id: step.id,
            order: step.order,
            agentId: step.agentId,
            agentVersion: step.agentVersion,
            agentConfigId: step.agentConfigId,
            input: step.input,
            config: step.config,
          })),
        },
        db,
      );
      if (!pipelineValidation.valid) {
        const warningText = pipelineValidation.warnings.join("; ");
        logRunPipelineIssue(
          "validate-pipeline",
          pipeline.id,
          "Pipeline invalid",
          {
            warnings: pipelineValidation.warnings,
          },
        );
        return errorResponse(`Pipeline is invalid: ${warningText}`);
      }

      const invokeRequestTimeoutMs =
        pipeline.timeout ?? MANUAL_INVOKE_AGENT_REQUEST_TIMEOUT_MS;

      const effectiveExecutionConfig = mergeExecutionConfig(
        pipeline.executionConfig,
        null,
      );
      const planning = await planPipelineInvocations({
        db,
        pipeline: {
          id: pipeline.id,
          domainIntegrationId: pipeline.domainIntegrationId,
          steps: pipeline.steps,
        },
        sourceId: pipeline.id,
        expandStepInputs,
        variableSecretMasterKey: env.HERMES_INTERNAL_API_KEY,
        variableSecretFallbackMasterKey: env.HERMES_INTERNAL_API_KEY_PREVIOUS,
        requireHttpsAgentEndpoints: false,
      });
      const executionTime = now();
      const waveList = planning.waveList.map((wave) =>
        wave.map((planned) => ({
          ...planned,
          jobId: randomUUID(),
        })),
      );
      const plannedJobs = waveList.flat();
      const jobsCreated = plannedJobs.length;

      if (planning.errors.length > 0) {
        logRunPipelineIssue(
          "planning",
          pipeline.id,
          "Planning reported errors (run may be partial or empty)",
          {
            planningErrors: planning.errors,
            jobsPlanned: jobsCreated,
            stepCount: pipeline.steps.length,
          },
        );
      }
      if (jobsCreated === 0) {
        logRunPipelineIssue(
          "planning",
          pipeline.id,
          "No invocations planned - expandStepInputs yielded no jobs (check step inputs / agent expansion)",
          {
            planningErrorCount: planning.errors.length,
            stepCount: pipeline.steps.length,
          },
        );
      }

      const enqueueStatus =
        jobsCreated === 0
          ? ScheduleEnqueueStatus.failed
          : planning.errors.length > 0
            ? ScheduleEnqueueStatus.partial
            : ScheduleEnqueueStatus.success;
      const initialExecutionErrors: Prisma.InputJsonValue | undefined =
        planning.errors.length > 0
          ? (planning.errors as Prisma.InputJsonValue)
          : jobsCreated === 0 && enqueueStatus === ScheduleEnqueueStatus.failed
            ? ([
                {
                  message:
                    "No invocations planned for this pipeline run (check inputs and agents)",
                  timestamp: executionTime.toISOString(),
                  phase: "planning",
                },
              ] satisfies EnqueueDiagnosticEntry[] as Prisma.InputJsonValue)
            : undefined;
      const execution = await db.manualPipelineExecution.create({
        data: {
          pipelineId: pipeline.id,
          executionTime,
          enqueueStatus,
          runStatus: jobsCreated === 0 ? ScheduleRunStatus.failed : "running",
          effectiveExecutionConfig:
            effectiveExecutionConfig as Prisma.InputJsonValue,
          jobsCreated,
          jobsEnqueued: 0,
          errors: initialExecutionErrors,
          metadata: mergeHermesEnqueueCorrelationIntoMetadata(
            {
              source: "dashboard",
              initiatedByUserId: session.id,
              initiatedByUserEmail: session.email,
            },
            { requestId: runRequestId },
          ) as Prisma.InputJsonValue,
        },
        select: { id: true },
      });

      const stepExpected = new Map<string, number>();
      for (const job of plannedJobs) {
        stepExpected.set(
          job.pipelineStepId,
          (stepExpected.get(job.pipelineStepId) ?? 0) + 1,
        );
      }

      for (const step of pipeline.steps) {
        const expectedInvocationCount = stepExpected.get(step.id) ?? 0;
        await db.manualPipelineStepExecution.create({
          data: {
            manualExecutionId: execution.id,
            pipelineStepId: step.id,
            expectedInvocationCount,
            rollupStatus:
              expectedInvocationCount > 0
                ? ScheduleStepRollupStatus.running
                : ScheduleStepRollupStatus.pending,
          },
        });
      }

      if (jobsCreated === 0) {
        return successResponse({
          ok: true as const,
          invocationsRun: 0,
          executionId: execution.id,
          runStatus: "failed",
          failedInvocationCount: 0,
        });
      }

      const enqueueItems: EnqueueInvokeAgentItem[] = [];
      let lastWaveIndices: number[] = [];
      const enqueueDiagnostics: EnqueueDiagnosticEntry[] = [...planning.errors];

      for (const wave of waveList) {
        const waveStart = enqueueItems.length;
        const useSequentialDeps =
          effectiveExecutionConfig.stepOrder === "sequential" &&
          lastWaveIndices.length > 0;
        for (const job of wave) {
          const step = pipeline.steps.find(
            (item) => item.id === job.pipelineStepId,
          );
          if (!step) {
            logRunPipelineIssue(
              "agent-invoke",
              pipeline.id,
              "Planned job references missing pipeline step",
              {
                jobId: job.jobId,
                pipelineStepId: job.pipelineStepId,
                agentId: job.agentId,
              },
            );
            enqueueDiagnostics.push({
              message: `Missing pipeline step ${job.pipelineStepId} (job ${job.jobId})`,
              timestamp: now().toISOString(),
              phase: "transaction",
              pipelineStepId: job.pipelineStepId,
              code: "MISSING_PIPELINE_STEP",
            });
            continue;
          }
          enqueueItems.push({
            payload: {
              jobId: job.jobId,
              executionId: randomUUID(),
              manualExecutionId: execution.id,
              pipelineId: pipeline.id,
              pipelineStepId: job.pipelineStepId,
              domainIntegrationId: pipeline.domainIntegrationId,
              agentId: job.agentId,
              agentVersion: job.agentVersion,
              endpointUrl: job.endpointUrl,
              body: { input: job.input, config: job.config },
              timeoutMs: invokeRequestTimeoutMs,
              priority: 0,
            },
            dependsOnBatchIndices: useSequentialDeps
              ? [...lastWaveIndices]
              : undefined,
          });
        }
        if (enqueueItems.length > waveStart) {
          lastWaveIndices = Array.from(
            { length: enqueueItems.length - waveStart },
            (_, idx) => waveStart + idx,
          );
        }
      }

      if (enqueueItems.length === 0) {
        await db.manualPipelineExecution.update({
          where: { id: execution.id },
          data: {
            runStatus: ScheduleRunStatus.failed,
            errors:
              enqueueDiagnostics.length > 0
                ? (enqueueDiagnostics as Prisma.InputJsonValue)
                : Prisma.DbNull,
          },
        });
        return successResponse({
          ok: true as const,
          invocationsRun: 0,
          executionId: execution.id,
          runStatus: "failed",
          failedInvocationCount: 0,
        });
      }

      await db.$transaction(async (tx) => {
        for (const item of enqueueItems) {
          await tx.agentJobExecution.create({
            data: {
              jobId: item.payload.jobId,
              agentId: item.payload.agentId,
              manualExecutionId: execution.id,
              pipelineId: pipeline.id,
              pipelineStepId: item.payload.pipelineStepId,
              status: AgentJobExecutionStatus.pending,
              enqueuedAt: executionTime,
              params: item.payload.body.input as Prisma.InputJsonValue,
              invocationConfig: item.payload.body
                .config as Prisma.InputJsonValue,
            },
          });
        }
      });

      let jobsEnqueued = 0;
      try {
        await enqueueManualAgentInvocations(enqueueItems);
        jobsEnqueued = enqueueItems.length;
      } catch (err) {
        enqueueDiagnostics.push(
          diagnosticFromCaughtError(err, {
            phase: "enqueue",
            messagePrefix: "Failed to enqueue agent invocations",
          }),
        );
        for (const item of enqueueItems) {
          try {
            await db.agentJobExecution.update({
              where: { jobId: item.payload.jobId },
              data: {
                status: AgentJobExecutionStatus.failed,
                error: {
                  message: err instanceof Error ? err.message : String(err),
                  retryable: true,
                },
                completedAt: now(),
              },
            });
          } catch {
            // Best-effort: row may be missing if transaction was rolled back.
          }
        }
        await db.manualPipelineExecution.update({
          where: { id: execution.id },
          data: {
            enqueueStatus:
              jobsEnqueued > 0
                ? ScheduleEnqueueStatus.partial
                : ScheduleEnqueueStatus.failed,
            runStatus: ScheduleRunStatus.failed,
            jobsEnqueued,
            errors:
              enqueueDiagnostics.length > 0
                ? (enqueueDiagnostics as Prisma.InputJsonValue)
                : undefined,
          },
        });
        return successResponse({
          ok: true as const,
          invocationsRun: 0,
          executionId: execution.id,
          runStatus: "failed",
          failedInvocationCount: 0,
        });
      }

      await db.manualPipelineExecution.update({
        where: { id: execution.id },
        data: {
          enqueueStatus:
            enqueueDiagnostics.length > 0
              ? ScheduleEnqueueStatus.partial
              : ScheduleEnqueueStatus.success,
          jobsEnqueued,
          errors:
            enqueueDiagnostics.length > 0
              ? (enqueueDiagnostics as Prisma.InputJsonValue)
              : undefined,
        },
      });

      return successResponse({
        ok: true as const,
        invocationsRun: jobsEnqueued,
        executionId: execution.id,
        runStatus: "running",
        failedInvocationCount: 0,
      });
    } catch (err) {
      logRunPipelineIssue(
        "unhandled",
        pipelineIdRequest,
        "Unexpected error while running pipeline",
        {},
        err,
      );
      const message = err instanceof Error ? err.message : String(err);
      return errorResponse(`Run pipeline failed: ${message}`);
    }
  };
};

/**
 * Handles manual run-pipeline requests.
 */
export const handler: RunPipelineHandler = createRunPipelineHandler();
