import { randomUUID } from "node:crypto";
import { createAgentTokenClient } from "@workspace/agent-auth-client";
import { env } from "@hermes/env";
import {
  prisma as orchestrationPrisma,
  Prisma,
  ScheduleRunStatus,
  ScheduleStepRollupStatus,
} from "@hermes/orchestration-database";
import {
  computeExecutionRunStatusFromStepRollups,
  computeStepRollupFromCounts,
  mergeExecutionConfig,
  substituteVariables,
} from "@hermes/scheduler";
import got from "got";
import {
  createRequestValidator,
  errorResponse,
  HandlerFunc,
  successResponse,
} from "route-action-gen/lib";
import { z } from "zod";

import { getDashboardSession } from "@/lib/auth-dashboard";
import { fetchAllTickersForPipelineRun } from "@/lib/domain-dashboard";
import { validatePipeline } from "@/lib/validate-pipeline";
import { buildRuntimeVariableMap } from "@/lib/variables";

const bodyValidator = z.object({
  pipelineId: z.string().uuid(),
});

export const requestValidator = createRequestValidator({
  body: bodyValidator,
});

export const responseValidator = z.object({
  ok: z.literal(true),
  tickersRun: z.number(),
  executionId: z.string().uuid(),
  runStatus: z.enum(["succeeded", "partial", "failed"]),
  failedInvocationCount: z.number(),
});

const AgentEndpointSchema = z.object({
  url: z.string().url(),
  method: z.string(),
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
      /* not JSON */
    }
    return trimmed.length > 300 ? `${trimmed.slice(0, 300)}…` : trimmed;
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

type RunPipelineHandlerDependencies = {
  getSession?: typeof getDashboardSession;
  /** Orchestration DB (pipelines, steps, agent registry). */
  db?: typeof orchestrationPrisma;
  /** Loads ticker ids via domain HTTP API (no direct Mediapulse DB). */
  fetchTickersForPipelineRun?: () => Promise<Array<{ id: string }>>;
  /** Returns a short-lived JWT for agent invocation. */
  getToken?: () => Promise<string>;
  post?: typeof got.post;
  now?: () => Date;
};

type StepRollupTerminal = "success" | "partial" | "failed";

type RunPipelineHandler = HandlerFunc<
  typeof requestValidator,
  typeof responseValidator,
  undefined
>;

/**
 * Creates the run-pipeline handler with injectable dependencies for tests.
 *
 * @param dependencies - Optional getSession, orchestration db, ticker fetch, getToken, and post (got.post).
 * @returns Handler that runs the pipeline for all tickers (each ticker gets all steps in order).
 *          Each agent POST body matches `createAgentApp`: `{ input, config }` with `tickerId` merged into `input`.
 */
export const createRunPipelineHandler = ({
  getSession = getDashboardSession,
  db = orchestrationPrisma,
  fetchTickersForPipelineRun = fetchAllTickersForPipelineRun,
  getToken = defaultGetToken ??
    (async () => {
      throw new Error(
        "AGENT_AUTH_API_URL and HERMES_INTERNAL_API_KEY are required",
      );
    }),
  post = got.post,
  now = () => new Date(),
}: RunPipelineHandlerDependencies = {}): RunPipelineHandler => {
  return async (data) => {
    const session = await getSession();
    if (!session) {
      return errorResponse("Unauthorized");
    }

    let jwt: string;
    try {
      jwt = await getToken();
    } catch (err) {
      console.error("--> error getting token", err);
      return errorResponse(
        "AGENT_AUTH_API_URL and HERMES_INTERNAL_API_KEY are required to run pipelines (JWT-only invocation)",
      );
    }

    const pipeline = await db.pipeline.findUnique({
      where: { id: data.body.pipelineId },
      select: {
        id: true,
        name: true,
        executionConfig: true,
        domainIntegrationId: true,
      },
    });
    if (!pipeline) {
      return errorResponse("Pipeline not found");
    }

    const pipelineStepFindArgs = {
      where: { pipelineId: data.body.pipelineId },
      orderBy: { order: "asc" as const },
      include: { agentConfig: true },
    } satisfies Prisma.PipelineStepFindManyArgs;

    const [pipelineSteps, tickers, variables] = await Promise.all([
      db.pipelineStep.findMany(pipelineStepFindArgs),
      fetchTickersForPipelineRun(),
      db.variable.findMany(),
    ]);
    const variableMap = buildRuntimeVariableMap(
      variables,
      env.HERMES_INTERNAL_API_KEY,
    );
    const pipelineValidation = await validatePipeline(
      {
        id: pipeline.id,
        name: pipeline.name,
        domainIntegrationId: pipeline.domainIntegrationId,
        steps: pipelineSteps.map((step) => ({
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
      return errorResponse(
        `Pipeline is invalid: ${pipelineValidation.warnings.join("; ")}`,
      );
    }

    if (tickers.length === 0) {
      const created = await db.manualPipelineExecution.create({
        data: {
          pipelineId: pipeline.id,
          executionTime: now(),
          enqueueStatus: "success",
          runStatus: "succeeded",
          effectiveExecutionConfig: mergeExecutionConfig(
            pipeline.executionConfig,
            null,
          ) as Prisma.InputJsonValue,
          jobsCreated: 0,
          jobsEnqueued: 0,
          metadata: {
            source: "dashboard",
            initiatedByUserId: session.id,
            initiatedByUserEmail: session.email,
          },
        },
        select: { id: true },
      });
      return successResponse({
        ok: true as const,
        tickersRun: 0,
        executionId: created.id,
        runStatus: "succeeded",
        failedInvocationCount: 0,
      });
    }

    const agentIds = pipelineSteps.map((step) => step.agentId);
    const agents = await db.agentRegistry.findMany({
      where: {
        agentId: { in: agentIds },
        domainIntegrationId: pipeline.domainIntegrationId,
      },
    });
    const agentByKey = new Map(
      agents.map((a) => [`${a.agentId}:${a.agentVersion}`, a]),
    );

    const effectiveExecutionConfig = mergeExecutionConfig(
      pipeline.executionConfig,
      null,
    );
    const executionTime = now();
    const jobsCreated = tickers.length * pipelineSteps.length;

    const execution = await db.manualPipelineExecution.create({
      data: {
        pipelineId: pipeline.id,
        executionTime,
        enqueueStatus: "success",
        runStatus: "running",
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

    const stepStats = new Map<
      string,
      {
        succeededCount: number;
        failedCount: number;
        expectedInvocationCount: number;
      }
    >();
    for (const step of pipelineSteps) {
      await db.manualPipelineStepExecution.create({
        data: {
          manualExecutionId: execution.id,
          pipelineStepId: step.id,
          expectedInvocationCount: tickers.length,
          rollupStatus: "running",
        },
      });
      stepStats.set(step.id, {
        succeededCount: 0,
        failedCount: 0,
        expectedInvocationCount: tickers.length,
      });
    }

    const errors: Array<{
      tickerId: string;
      step: string;
      detail: string;
      code: number | "unknown";
    }> = [];

    for (const ticker of tickers) {
      for (const step of pipelineSteps) {
        const agent = agentByKey.get(`${step.agentId}:${step.agentVersion}`);
        if (!agent) {
          const stat = stepStats.get(step.id);
          if (stat) stat.failedCount += 1;
          errors.push({
            tickerId: ticker.id,
            step: `${step.agentId}@${step.agentVersion}`,
            detail: "Agent registry entry not found",
            code: "unknown",
          });
          continue;
        }
        const endpoint = await AgentEndpointSchema.parseAsync(agent.endpoint);

        const rawInput =
          step.input != null &&
          typeof step.input === "object" &&
          !Array.isArray(step.input)
            ? (step.input as Record<string, unknown>)
            : {};
        const inputSubstituted = substituteVariables(
          rawInput,
          variableMap,
        ) as Record<string, unknown>;
        const mergedInput: Record<string, unknown> = {
          ...inputSubstituted,
          tickerId: ticker.id,
        };

        let stepConfig: Record<string, unknown>;
        if (step.agentConfigId != null && step.agentConfig != null) {
          const referencedConfig = step.agentConfig.config;
          const configObj =
            referencedConfig != null &&
            typeof referencedConfig === "object" &&
            !Array.isArray(referencedConfig)
              ? (referencedConfig as Record<string, unknown>)
              : {};
          stepConfig = configObj;
        } else {
          stepConfig =
            step.config != null &&
            typeof step.config === "object" &&
            !Array.isArray(step.config)
              ? (step.config as Record<string, unknown>)
              : {};
        }
        stepConfig = substituteVariables(stepConfig, variableMap) as Record<
          string,
          unknown
        >;

        const jobId = randomUUID();
        await db.agentJobExecution.create({
          data: {
            jobId,
            agentId: step.agentId,
            manualExecutionId: execution.id,
            pipelineId: pipeline.id,
            pipelineStepId: step.id,
            status: "running",
            enqueuedAt: executionTime,
            startedAt: now(),
            params: mergedInput as Prisma.InputJsonValue,
            invocationConfig: stepConfig as Prisma.InputJsonValue,
          },
        });

        try {
          const agentResponse = await post(endpoint.url, {
            json: { input: mergedInput, config: stepConfig },
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${jwt}`,
            },
            throwHttpErrors: false,
          });
          const res = agentResponse as {
            ok?: boolean;
            statusCode?: number;
            body?: unknown;
          };
          if (res.ok === true) {
            const stat = stepStats.get(step.id);
            if (stat) stat.succeededCount += 1;
            await db.agentJobExecution.update({
              where: { jobId },
              data: {
                status: "completed",
                completedAt: now(),
                error: Prisma.DbNull,
                agentResponse:
                  (res.body as Prisma.InputJsonValue | undefined) ??
                  Prisma.DbNull,
                semanticStatus: "success",
              },
            });
          } else {
            const detail = detailFromAgentErrorBody(res.body);
            const code = res.statusCode ?? "unknown";
            const stat = stepStats.get(step.id);
            if (stat) stat.failedCount += 1;
            errors.push({
              tickerId: ticker.id,
              step: `${step.agentId}@${step.agentVersion}`,
              detail,
              code,
            });
            await db.agentJobExecution.update({
              where: { jobId },
              data: {
                status: "failed",
                completedAt: now(),
                error: {
                  detail,
                  code,
                  tickerId: ticker.id,
                },
                agentResponse:
                  (res.body as Prisma.InputJsonValue | undefined) ??
                  Prisma.DbNull,
                semanticStatus: "failure",
              },
            });
          }
        } catch (err) {
          const detail = err instanceof Error ? err.message : String(err);
          const stat = stepStats.get(step.id);
          if (stat) stat.failedCount += 1;
          errors.push({
            tickerId: ticker.id,
            step: `${step.agentId}@${step.agentVersion}`,
            detail,
            code: "unknown",
          });
          await db.agentJobExecution.update({
            where: { jobId },
            data: {
              status: "failed",
              completedAt: now(),
              error: {
                detail,
                code: "unknown",
                tickerId: ticker.id,
              },
              semanticStatus: "failure",
            },
          });
        }
      }
    }

    const stepRollups: StepRollupTerminal[] = [];
    for (const step of pipelineSteps) {
      const stat = stepStats.get(step.id);
      if (!stat) continue;
      const rollup = computeStepRollupFromCounts(
        stat.succeededCount,
        stat.failedCount,
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
          succeededCount: stat.succeededCount,
          failedCount: stat.failedCount,
          rollupStatus: stepTerminalToPrismaRollup(rollup),
        },
      });
    }

    const finalRunStatus = computeExecutionRunStatusFromStepRollups(
      stepRollups,
      effectiveExecutionConfig.stepRollupPolicy,
    );
    const failedInvocationCount = Array.from(stepStats.values()).reduce(
      (acc, item) => acc + item.failedCount,
      0,
    );

    await db.manualPipelineExecution.update({
      where: { id: execution.id },
      data: {
        runStatus: runStatusTerminalToPrisma(finalRunStatus),
        succeededInvocationCount: jobsCreated - failedInvocationCount,
        failedInvocationCount,
        errors:
          errors.length > 0 ? (errors as Prisma.InputJsonValue) : Prisma.DbNull,
      },
    });

    return successResponse({
      ok: true as const,
      tickersRun: tickers.length,
      executionId: execution.id,
      runStatus: finalRunStatus,
      failedInvocationCount,
    });
  };
};

/**
 * Converts scheduler terminal step rollups to Prisma enum values.
 *
 * @param terminal - Scheduler terminal rollup.
 * @returns Prisma rollup enum for storage.
 */
const stepTerminalToPrismaRollup = (
  terminal: StepRollupTerminal,
): ScheduleStepRollupStatus => {
  if (terminal === "success") return ScheduleStepRollupStatus.success;
  if (terminal === "partial") return ScheduleStepRollupStatus.partial;
  return ScheduleStepRollupStatus.failed;
};

/**
 * Converts scheduler run terminal value to Prisma run status.
 *
 * @param status - Scheduler run terminal value.
 * @returns Prisma run status enum.
 */
const runStatusTerminalToPrisma = (
  status: "succeeded" | "partial" | "failed",
): ScheduleRunStatus => {
  if (status === "succeeded") return ScheduleRunStatus.succeeded;
  if (status === "partial") return ScheduleRunStatus.partial;
  return ScheduleRunStatus.failed;
};

/**
 * Handles run pipeline: validates session and runs pipeline for all tickers (steps in order per ticker).
 */
export const handler: RunPipelineHandler = createRunPipelineHandler();
