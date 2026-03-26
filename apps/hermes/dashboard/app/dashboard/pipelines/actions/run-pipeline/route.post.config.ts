import { randomUUID } from "node:crypto";
import { env } from "@hermes/env";
import {
  prisma as orchestrationPrisma,
  Prisma,
  AgentJobExecutionStatus,
  ScheduleEnqueueStatus,
  ScheduleRunStatus,
  ScheduleStepRollupStatus,
} from "@hermes/orchestration-database";
import {
  mergeExecutionConfig,
  planPipelineInvocations,
  type ExpandStepInputs,
  type EnqueueInvokeAgentItem,
  type InvokeAgentJobPayload,
} from "@hermes/scheduler";
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

export const requestValidator = createRequestValidator({
  body: bodyValidator,
  user: requireDashboardSessionForRoute,
});

export const responseValidator = z.object({
  ok: z.literal(true),
  invocationsQueued: z.number(),
  executionId: z.string().uuid(),
  runStatus: z.enum(["pending", "failed"]),
});

type QueueClient = Pick<
  ReturnType<typeof getHermesJobQueue>,
  "addJobs" | "editJob"
>;

type RunPipelineHandlerDependencies = {
  db?: typeof orchestrationPrisma;
  queue?: QueueClient;
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
  queue,
  now = () => new Date(),
  expandStepInputs = createExpandStepInputsForManualPipelineRun(),
}: RunPipelineHandlerDependencies = {}): RunPipelineHandler => {
  return async (data) => {
    const queueClient = queue ?? getHermesJobQueue();
    const session = data.user;

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
      return errorResponse(
        `Pipeline is invalid: ${pipelineValidation.warnings.join("; ")}`,
      );
    }

    const effectiveExecutionConfig = mergeExecutionConfig(
      pipeline.executionConfig,
      null,
    );
    const executionTime = now();
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
    const waveList = planning.waveList.map((wave) =>
      wave.map((planned) => ({
        ...planned,
        jobId: randomUUID(),
        executionId: randomUUID(),
      })),
    );
    const plannedJobs = waveList.flat();
    const jobsCreated = plannedJobs.length;

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
        runStatus:
          jobsCreated === 0
            ? ScheduleRunStatus.failed
            : ScheduleRunStatus.pending,
        effectiveExecutionConfig:
          effectiveExecutionConfig as Prisma.InputJsonValue,
        jobsCreated,
        jobsEnqueued: 0,
        errors:
          planning.errors.length > 0
            ? (planning.errors as Prisma.InputJsonValue)
            : undefined,
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

    const enqueueItems: EnqueueInvokeAgentItem[] = [];
    let lastWaveIndices: number[] = [];
    for (const wave of waveList) {
      const waveStart = enqueueItems.length;
      const useSequentialDeps =
        effectiveExecutionConfig.stepOrder === "sequential" &&
        lastWaveIndices.length > 0;
      for (const job of wave) {
        enqueueItems.push({
          payload: {
            jobId: job.jobId,
            executionId: job.executionId,
            manualExecutionId: execution.id,
            pipelineId: pipeline.id,
            pipelineStepId: job.pipelineStepId,
            domainIntegrationId: pipeline.domainIntegrationId,
            agentId: job.agentId,
            agentVersion: job.agentVersion,
            endpointUrl: job.endpointUrl,
            body: { input: job.input, config: job.config },
            timeoutMs: 300_000,
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
          (_, index) => waveStart + index,
        );
      }
    }

    await db.$transaction(async (tx) => {
      for (const [pipelineStepId, expectedInvocationCount] of stepExpected) {
        await tx.manualPipelineStepExecution.create({
          data: {
            manualExecutionId: execution.id,
            pipelineStepId,
            expectedInvocationCount,
            rollupStatus: ScheduleStepRollupStatus.pending,
          },
        });
      }
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
            invocationConfig: item.payload.body.config as Prisma.InputJsonValue,
          },
        });
      }
    });

    let jobsEnqueued = 0;
    try {
      const queueJobs = enqueueItems.map((item) => ({
        jobType: "invoke_agent" as const,
        payload: item.payload,
        priority: item.payload.priority,
        idempotencyKey: item.payload.jobId,
        dependsOn:
          item.dependsOnBatchIndices && item.dependsOnBatchIndices.length > 0
            ? {
                jobIds: item.dependsOnBatchIndices.map((index) =>
                  batchDepRef(index),
                ),
              }
            : undefined,
        tags: [
          `manualExecution:${execution.id}`,
          `pipeline:${item.payload.pipelineId}`,
          `pipelineStep:${item.payload.pipelineStepId}`,
        ],
      }));
      const insertedIds = await queueClient.addJobs(queueJobs);
      jobsEnqueued = insertedIds.length;
      for (let index = 0; index < insertedIds.length; index++) {
        const queueJobId = insertedIds[index];
        const item = enqueueItems[index];
        if (queueJobId === undefined || item === undefined) continue;
        await queueClient.editJob(queueJobId, {
          payload: {
            ...(item.payload as InvokeAgentJobPayload),
            hermesDataQueueJobId: queueJobId,
          },
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await db.$transaction(async (tx) => {
        await tx.manualPipelineExecution.update({
          where: { id: execution.id },
          data: {
            enqueueStatus: ScheduleEnqueueStatus.failed,
            runStatus: ScheduleRunStatus.failed,
            jobsEnqueued,
            errors: [
              ...planning.errors,
              {
                message: `Failed to enqueue manual execution: ${message}`,
                timestamp: now().toISOString(),
              },
            ] as Prisma.InputJsonValue,
          },
        });
        await tx.agentJobExecution.updateMany({
          where: {
            manualExecutionId: execution.id,
            status: AgentJobExecutionStatus.pending,
          },
          data: {
            status: AgentJobExecutionStatus.failed,
            completedAt: now(),
            error: {
              message,
              retryable: true,
            },
          },
        });
      });
      return errorResponse(
        "Failed to enqueue manual execution jobs. Please retry.",
      );
    }

    await db.manualPipelineExecution.update({
      where: { id: execution.id },
      data: {
        jobsEnqueued,
        enqueueStatus:
          planning.errors.length > 0
            ? ScheduleEnqueueStatus.partial
            : ScheduleEnqueueStatus.success,
      },
    });

    return successResponse({
      ok: true as const,
      invocationsQueued: jobsCreated,
      executionId: execution.id,
      runStatus: jobsCreated > 0 ? ("pending" as const) : ("failed" as const),
    });
  };
};

/**
 * Handles manual run-pipeline requests.
 */
export const handler: RunPipelineHandler = createRunPipelineHandler();
