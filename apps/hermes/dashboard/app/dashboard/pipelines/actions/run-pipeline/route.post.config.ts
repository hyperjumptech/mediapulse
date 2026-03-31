import { randomUUID } from "node:crypto";
import { createAgentTokenClient } from "@workspace/agent-auth-client";
import { env } from "@hermes/env";
import {
  prisma as orchestrationPrisma,
  Prisma,
  ScheduleEnqueueStatus,
  ScheduleRunStatus,
  ScheduleStepRollupStatus,
} from "@hermes/orchestration-database";
import {
  computeExecutionRunStatusFromStepRollups,
  computeStepRollupFromCounts,
  mergeExecutionConfig,
  planPipelineInvocations,
  type ExpandStepInputs,
} from "@hermes/scheduler";
import got from "got";
import {
  createRequestValidator,
  errorResponse,
  type HandlerFunc,
  successResponse,
} from "route-action-gen/lib";
import { z } from "zod";

import { requireDashboardSessionForRoute } from "@/lib/auth-dashboard";
import { createExpandStepInputsForManualPipelineRun } from "@/lib/expand-step-inputs-for-manual-pipeline";
import { validatePipeline } from "@/lib/validate-pipeline";

const bodyValidator = z.object({
  pipelineId: z.string().uuid(),
});

/** Prefix for server logs when debugging Run pipeline in Docker or `pnpm dev` output. */
const RUN_PIPELINE_LOG_PREFIX = "[hermes-dashboard:run-pipeline]";

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
  runStatus: z.enum(["succeeded", "partial", "failed"]),
  failedInvocationCount: z.number(),
});

/**
 * Builds a short human-readable detail from an agent error response body (JSON object or string).
 *
 * @param body - Parsed or raw body from `got` when `throwHttpErrors` is false.
 * @returns Message for dashboard users (agent `message` field when present).
 */
export const detailFromAgentErrorBody = (body: unknown): string => {
  if (body === null || body === undefined) {
    return "Unknown error (empty response body)";
  }
  if (typeof body === "string") {
    const trimmed = body.trim();
    if (!trimmed) return "Unknown error (empty response body)";
    try {
      const parsed = JSON.parse(trimmed) as { message?: unknown };
      if (typeof parsed.message === "string" && parsed.message.length > 0) {
        return parsed.message;
      }
    } catch {
      // Not JSON.
    }
    return trimmed.length > 300 ? `${trimmed.slice(0, 300)}...` : trimmed;
  }
  if (typeof body === "object" && !Array.isArray(body)) {
    const msg = (body as { message?: unknown }).message;
    if (typeof msg === "string" && msg.length > 0) return msg;
  }
  return "Unknown error (see agent logs)";
};

const defaultGetToken =
  env.AGENT_AUTH_API_URL && env.HERMES_INTERNAL_API_KEY
    ? createAgentTokenClient({
        authApiUrl: env.AGENT_AUTH_API_URL,
        credential: env.HERMES_INTERNAL_API_KEY,
      }).getToken
    : null;

type StepRollupTerminal = "success" | "partial" | "failed";

type RunPipelineHandlerDependencies = {
  db?: typeof orchestrationPrisma;
  getToken?: () => Promise<string>;
  post?: typeof got.post;
  now?: () => Date;
  expandStepInputs?: ExpandStepInputs;
};

type RunPipelineHandler = HandlerFunc<
  typeof requestValidator,
  typeof responseValidator,
  undefined
>;

/**
 * Executes one manual pipeline run and persists full execution lineage.
 *
 * @param dependencies - Optional collaborators for tests.
 * @returns Route-action-gen handler for manual run requests.
 */
export const createRunPipelineHandler = ({
  db = orchestrationPrisma,
  getToken = defaultGetToken ??
    (async () => {
      throw new Error(
        "AGENT_AUTH_API_URL and HERMES_INTERNAL_API_KEY are required",
      );
    }),
  post = got.post,
  now = () => new Date(),
  expandStepInputs = createExpandStepInputsForManualPipelineRun(),
}: RunPipelineHandlerDependencies = {}): RunPipelineHandler => {
  return async (data) => {
    const pipelineIdRequest = data.body.pipelineId;

    try {
      const session = data.user;

      let jwt: string;
      try {
        jwt = await getToken();
      } catch (err) {
        logRunPipelineIssue(
          "token",
          pipelineIdRequest,
          "Failed to obtain JWT for agent invocation (check AGENT_AUTH_API_URL and HERMES_INTERNAL_API_KEY)",
          {},
          err,
        );
        return errorResponse(
          "AGENT_AUTH_API_URL and HERMES_INTERNAL_API_KEY are required to run pipelines (JWT-only invocation)",
        );
      }

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
      const execution = await db.manualPipelineExecution.create({
        data: {
          pipelineId: pipeline.id,
          executionTime,
          enqueueStatus,
          runStatus: jobsCreated === 0 ? ScheduleRunStatus.failed : "running",
          effectiveExecutionConfig:
            effectiveExecutionConfig as Prisma.InputJsonValue,
          jobsCreated,
          jobsEnqueued: jobsCreated,
          metadata: {
            source: "dashboard",
            initiatedByUserId: session.id,
            initiatedByUserEmail: session.email,
          },
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

      const stepStats = new Map<
        string,
        {
          succeededCount: number;
          failedCount: number;
          expectedInvocationCount: number;
        }
      >();
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
        stepStats.set(step.id, {
          succeededCount: 0,
          failedCount: 0,
          expectedInvocationCount,
        });
      }

      const errors: Array<{
        step: string;
        detail: string;
        code: number | "unknown";
        jobId: string;
      }> = planning.errors.map((error) => ({
        step: "planning",
        detail: error.message,
        code: "unknown",
        jobId: "planning",
      }));

      for (const wave of waveList) {
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
            errors.push({
              step: "unknown",
              detail: `Missing pipeline step ${job.pipelineStepId}`,
              code: "unknown",
              jobId: job.jobId,
            });
            continue;
          }

          await db.agentJobExecution.create({
            data: {
              jobId: job.jobId,
              agentId: job.agentId,
              manualExecutionId: execution.id,
              pipelineId: pipeline.id,
              pipelineStepId: step.id,
              status: "running",
              enqueuedAt: executionTime,
              startedAt: now(),
              params: job.input as Prisma.InputJsonValue,
              invocationConfig: job.config as Prisma.InputJsonValue,
            },
          });

          try {
            const agentResponse = await post(job.endpointUrl, {
              json: { input: job.input, config: job.config },
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${jwt}`,
              },
              throwHttpErrors: false,
            });
            const response = agentResponse as {
              ok?: boolean;
              statusCode?: number;
              body?: unknown;
            };
            if (response.ok === true) {
              const stats = stepStats.get(step.id);
              if (stats) stats.succeededCount += 1;
              await db.agentJobExecution.update({
                where: { jobId: job.jobId },
                data: {
                  status: "completed",
                  completedAt: now(),
                  error: Prisma.DbNull,
                  agentResponse:
                    (response.body as Prisma.InputJsonValue | undefined) ??
                    Prisma.DbNull,
                  semanticStatus: "success",
                },
              });
              continue;
            }

            const detail = detailFromAgentErrorBody(response.body);
            const code = response.statusCode ?? "unknown";
            logRunPipelineIssue(
              "agent-http",
              pipeline.id,
              "Agent HTTP response was not OK",
              {
                jobId: job.jobId,
                pipelineStepId: step.id,
                agentId: step.agentId,
                agentVersion: step.agentVersion,
                endpointUrl: job.endpointUrl,
                statusCode: code,
                detail,
              },
            );
            const stats = stepStats.get(step.id);
            if (stats) stats.failedCount += 1;
            errors.push({
              step: `${step.agentId}@${step.agentVersion}`,
              detail,
              code,
              jobId: job.jobId,
            });
            await db.agentJobExecution.update({
              where: { jobId: job.jobId },
              data: {
                status: "failed",
                completedAt: now(),
                error: {
                  detail,
                  code,
                  jobId: job.jobId,
                },
                agentResponse:
                  (response.body as Prisma.InputJsonValue | undefined) ??
                  Prisma.DbNull,
                semanticStatus: "failure",
              },
            });
          } catch (err) {
            const detail = err instanceof Error ? err.message : String(err);
            logRunPipelineIssue(
              "agent-http",
              pipeline.id,
              "Agent HTTP request threw (network/DNS/TLS/timeout)",
              {
                jobId: job.jobId,
                pipelineStepId: step.id,
                agentId: step.agentId,
                agentVersion: step.agentVersion,
                endpointUrl: job.endpointUrl,
                detail,
              },
              err,
            );
            const stats = stepStats.get(step.id);
            if (stats) stats.failedCount += 1;
            errors.push({
              step: `${step.agentId}@${step.agentVersion}`,
              detail,
              code: "unknown",
              jobId: job.jobId,
            });
            await db.agentJobExecution.update({
              where: { jobId: job.jobId },
              data: {
                status: "failed",
                completedAt: now(),
                error: {
                  detail,
                  code: "unknown",
                  jobId: job.jobId,
                },
                semanticStatus: "failure",
              },
            });
          }
        }
      }

      const stepRollups: StepRollupTerminal[] = [];
      for (const step of pipeline.steps) {
        const stats = stepStats.get(step.id);
        if (!stats) continue;
        const rollup = computeStepRollupFromCounts(
          stats.succeededCount,
          stats.failedCount,
          effectiveExecutionConfig.stepRollupPolicy,
        );
        stepRollups.push(rollup);
        await db.manualPipelineStepExecution.update({
          where: {
            manualExecutionId_pipelineStepId: {
              manualExecutionId: execution.id,
              pipelineStepId: step.id,
            },
          },
          data: {
            succeededCount: stats.succeededCount,
            failedCount: stats.failedCount,
            rollupStatus: stepTerminalToPrismaRollup(rollup),
          },
        });
      }

      const finalRunStatus =
        jobsCreated === 0
          ? "failed"
          : computeExecutionRunStatusFromStepRollups(
              stepRollups,
              effectiveExecutionConfig.stepRollupPolicy,
            );
      const failedInvocationCount = Array.from(stepStats.values()).reduce(
        (sum, item) => sum + item.failedCount,
        0,
      );
      await db.manualPipelineExecution.update({
        where: { id: execution.id },
        data: {
          runStatus: runStatusTerminalToPrisma(finalRunStatus),
          succeededInvocationCount: jobsCreated - failedInvocationCount,
          failedInvocationCount,
          errors:
            errors.length > 0
              ? (errors as Prisma.InputJsonValue)
              : Prisma.DbNull,
        },
      });

      return successResponse({
        ok: true as const,
        invocationsRun: jobsCreated,
        executionId: execution.id,
        runStatus: finalRunStatus,
        failedInvocationCount,
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
 * Converts scheduler terminal step rollups to Prisma rollup status values.
 *
 * @param terminal - Scheduler terminal rollup value.
 * @returns Prisma rollup enum.
 */
const stepTerminalToPrismaRollup = (
  terminal: StepRollupTerminal,
): ScheduleStepRollupStatus => {
  if (terminal === "success") return ScheduleStepRollupStatus.success;
  if (terminal === "partial") return ScheduleStepRollupStatus.partial;
  return ScheduleStepRollupStatus.failed;
};

/**
 * Converts scheduler terminal run status to Prisma run status.
 *
 * @param status - Scheduler run terminal value.
 * @returns Prisma run enum.
 */
const runStatusTerminalToPrisma = (
  status: "succeeded" | "partial" | "failed",
): ScheduleRunStatus => {
  if (status === "succeeded") return ScheduleRunStatus.succeeded;
  if (status === "partial") return ScheduleRunStatus.partial;
  return ScheduleRunStatus.failed;
};

/**
 * Handles manual run-pipeline requests.
 */
export const handler: RunPipelineHandler = createRunPipelineHandler();
