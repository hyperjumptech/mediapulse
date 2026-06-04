import { randomUUID } from "node:crypto";
import {
  AgentJobExecutionStatus,
  Prisma,
  ScheduleEnqueueStatus,
  ScheduleRunStatus,
  ScheduleStepRollupStatus,
  type PrismaClient,
} from "@hermes/orchestration-database";
import {
  diagnosticFromCaughtError,
  mergeExecutionConfig,
  planPipelineInvocations,
  type EnqueueDiagnosticEntry,
  type ExpandStepInputs,
} from "@hermes/scheduler";

import type { JobPayloadMap } from "./job-payload-map";

type ExecuteHttpTriggerDeps = {
  db: PrismaClient;
  enqueueAgentInvocations: (
    items: Array<{
      payload: JobPayloadMap["invoke_agent"];
      dependsOnBatchIndices?: number[];
    }>,
  ) => Promise<void>;
  expandStepInputs?: ExpandStepInputs;
  defaultTimeoutMs?: number;
  variableSecretMasterKey?: string;
  variableSecretFallbackMasterKey?: string;
};

/**
 * Plans and enqueues pipeline agent invocations for an HTTP trigger execution.
 */
export const executeHttpTrigger = async (
  httpTriggerExecutionId: string,
  deps: ExecuteHttpTriggerDeps,
): Promise<void> => {
  const {
    db,
    enqueueAgentInvocations,
    expandStepInputs = async (context) => [context.input],
    defaultTimeoutMs = 300_000,
    variableSecretMasterKey,
    variableSecretFallbackMasterKey,
  } = deps;
  const execution = await db.httpTriggerExecution.findUnique({
    where: { id: httpTriggerExecutionId },
    include: {
      httpTrigger: {
        include: {
          pipeline: {
            include: {
              steps: {
                include: {
                  agentConfig: true,
                  agentContract: { select: { brief: true, version: true } },
                },
                orderBy: { order: "asc" },
              },
            },
          },
        },
      },
    },
  });
  if (!execution) return;

  const trigger = execution.httpTrigger;
  const pipeline = trigger.pipeline;
  const steps = pipeline.steps;
  const effectiveExecutionConfig = mergeExecutionConfig(
    pipeline.executionConfig,
    null,
  );
  const errors: EnqueueDiagnosticEntry[] = [];

  if (steps.length === 0) {
    await db.httpTriggerExecution.update({
      where: { id: httpTriggerExecutionId },
      data: {
        enqueueStatus: ScheduleEnqueueStatus.failed,
        runStatus: ScheduleRunStatus.failed,
        errors: [
          {
            message: "Pipeline has no steps",
            timestamp: new Date().toISOString(),
            phase: "planning",
          },
        ],
      },
    });
    return;
  }

  const planningResult = await planPipelineInvocations({
    db,
    pipeline: {
      id: pipeline.id,
      domainIntegrationId: pipeline.domainIntegrationId,
      steps,
    },
    sourceId: trigger.id,
    expandStepInputs,
    variableSecretMasterKey,
    variableSecretFallbackMasterKey,
    requireHttpsAgentEndpoints: false,
  });
  errors.push(...planningResult.errors);
  const waveList = planningResult.waveList.map((wave) =>
    wave.map((planned) => ({
      ...planned,
      jobId: randomUUID(),
      executionId: randomUUID(),
    })),
  );

  const plannedJobs = waveList.flat();
  const jobsCreated = plannedJobs.length;
  if (jobsCreated === 0) {
    await db.httpTriggerExecution.update({
      where: { id: httpTriggerExecutionId },
      data: {
        enqueueStatus: ScheduleEnqueueStatus.failed,
        runStatus: ScheduleRunStatus.failed,
        jobsCreated: 0,
        jobsEnqueued: 0,
        errors: errors as Prisma.InputJsonValue,
      },
    });
    return;
  }

  const stepExpected = new Map<string, number>();
  for (const job of plannedJobs) {
    stepExpected.set(
      job.pipelineStepId,
      (stepExpected.get(job.pipelineStepId) ?? 0) + 1,
    );
  }
  const enqueueItems: Array<{
    payload: JobPayloadMap["invoke_agent"];
    dependsOnBatchIndices?: number[];
  }> = [];
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
          httpTriggerExecutionId,
          httpTriggerId: trigger.id,
          pipelineId: pipeline.id,
          pipelineStepId: job.pipelineStepId,
          domainIntegrationId: pipeline.domainIntegrationId,
          agentId: job.agentId,
          agentVersion: job.agentVersion,
          endpointUrl: job.endpointUrl,
          body: {
            input: job.input,
            config: job.config,
            ...(job.contract !== undefined ? { contract: job.contract } : {}),
          },
          timeoutMs: pipeline.timeout ?? defaultTimeoutMs,
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

  await db.$transaction(async (tx) => {
    await tx.httpTriggerExecution.update({
      where: { id: httpTriggerExecutionId },
      data: {
        effectiveExecutionConfig:
          effectiveExecutionConfig as Prisma.InputJsonValue,
        jobsCreated,
      },
    });
    for (const [
      pipelineStepId,
      expectedInvocationCount,
    ] of stepExpected.entries()) {
      await tx.httpTriggerStepExecution.create({
        data: {
          httpTriggerExecutionId,
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
          httpTriggerId: trigger.id,
          httpTriggerExecutionId,
          pipelineId: pipeline.id,
          pipelineStepId: item.payload.pipelineStepId,
          status: AgentJobExecutionStatus.pending,
          enqueuedAt: new Date(),
          params: item.payload.body.input as Prisma.InputJsonValue,
          invocationConfig: item.payload.body.config as Prisma.InputJsonValue,
        },
      });
    }
  });

  let jobsEnqueued = 0;
  try {
    await enqueueAgentInvocations(enqueueItems);
    jobsEnqueued = enqueueItems.length;
  } catch (err) {
    errors.push(
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
            completedAt: new Date(),
          },
        });
      } catch {
        // Best-effort: row may be missing if transaction was rolled back.
      }
    }
    await db.httpTriggerExecution.update({
      where: { id: httpTriggerExecutionId },
      data: {
        enqueueStatus:
          jobsEnqueued > 0
            ? ScheduleEnqueueStatus.partial
            : ScheduleEnqueueStatus.failed,
        runStatus: ScheduleRunStatus.failed,
        jobsEnqueued,
        errors:
          errors.length > 0 ? (errors as Prisma.InputJsonValue) : undefined,
      },
    });
    return;
  }

  await db.httpTriggerExecution.update({
    where: { id: httpTriggerExecutionId },
    data: {
      enqueueStatus:
        errors.length > 0
          ? ScheduleEnqueueStatus.partial
          : ScheduleEnqueueStatus.success,
      jobsEnqueued,
      errors: errors.length > 0 ? (errors as Prisma.InputJsonValue) : undefined,
    },
  });
};
