import {
  AgentJobExecutionStatus,
  ScheduleEnqueueStatus,
  ScheduleRunStatus,
  ScheduleStepRollupStatus,
  type Prisma,
  type PrismaClient,
} from "@hermes/orchestration-database";
import { randomUUID } from "node:crypto";
import type { DueSchedule } from "./get-due-schedules";
import { mergeExecutionConfig } from "./execution-config";
import { computeNextRunAt } from "./next-run-at";
import {
  diagnosticFromCaughtError,
  type EnqueueDiagnosticEntry,
} from "./enqueue-diagnostics";
import { planPipelineInvocations } from "./plan-pipeline-invocations";

/**
 * Payload for a single agent invocation job (DataQueue job type `invoke_agent`).
 * Used when enqueueing so the worker can perform the HTTP call and update AgentJobExecution.
 */
export type InvokeAgentJobPayload = {
  jobId: string;
  executionId: string;
  /** Parent schedule execution row (correlation + rollup). */
  scheduleExecutionId?: string;
  scheduleId?: string;
  /** Parent HTTP trigger execution row (correlation + rollup). */
  httpTriggerExecutionId?: string;
  httpTriggerId?: string;
  /** Parent dashboard manual pipeline execution (correlation + rollup). */
  manualExecutionId?: string;
  pipelineId: string;
  pipelineStepId: string;
  /** JWT minting scope for agent invocation. */
  domainIntegrationId: string;
  agentId: string;
  agentVersion: string;
  endpointUrl: string;
  body: { input: Record<string, unknown>; config: Record<string, unknown> };
  timeoutMs: number;
  priority: number;
  /** Set by hermes-worker after `addJobs` (DataQueue numeric id) for transient retry orchestration. */
  hermesDataQueueJobId?: number;
};

/**
 * One entry in the `addJobs` batch: payload plus optional same-batch dependency indices for `batchDepRef`.
 */
export type EnqueueInvokeAgentItem = {
  payload: InvokeAgentJobPayload;
  /** Indices into the same batch passed to `addJobs` (resolved with `batchDepRef` in the worker). */
  dependsOnBatchIndices?: number[];
};

/**
 * Context for domain-specific step input expansion.
 */
export type ExpandStepInputsContext = {
  input: Record<string, unknown>;
  scheduleId: string;
  pipelineId: string;
  pipelineStepId: string;
  /** Domain integration that owns the pipeline (JWT + expansion HTTP). */
  domainIntegrationId: string;
  orchDb: PrismaClient;
};

export type ExpandStepInputs = (
  context: ExpandStepInputsContext,
) => Promise<Record<string, unknown>[]>;

/** Dependencies for executeSchedule (injectable for tests). */
export type ExecuteScheduleDeps = {
  db: PrismaClient;
  logger: {
    info: (obj: unknown, msg?: string) => void;
    warn: (obj: unknown, msg?: string) => void;
    error: (obj: unknown, msg?: string) => void;
  };
  /** Enqueues all agent jobs for the tick in one `addJobs` call (with optional `dependsOn`). */
  enqueueAgentInvocations: (items: EnqueueInvokeAgentItem[]) => Promise<void>;
  /** Domain integration hook that expands a single input into one-or-many invocation inputs. */
  expandStepInputs?: ExpandStepInputs;
  defaultTimeoutMs?: number;
  variableSecretMasterKey?: string;
  variableSecretFallbackMasterKey?: string;
  /** When true, reject agent endpoint URLs that use http with a non-local host. */
  requireHttpsAgentEndpoints?: boolean;
};

/**
 * Executes a due schedule: substitutes variables, expands inputs, persists execution rows,
 * then enqueues all `invoke_agent` jobs in one batch with sequential cross-step `dependsOn`.
 *
 * @param schedule - Schedule with pipeline and steps (from getDueSchedules).
 * @param deps - DB, logger, enqueue hook, expansion hook, timeout.
 */
export const executeSchedule = async (
  schedule: DueSchedule,
  deps: ExecuteScheduleDeps,
): Promise<void> => {
  const {
    db,
    logger,
    enqueueAgentInvocations,
    expandStepInputs = async (context) => [context.input],
    defaultTimeoutMs = 300_000,
    variableSecretMasterKey,
    variableSecretFallbackMasterKey,
    requireHttpsAgentEndpoints = false,
  } = deps;
  const executionTime = new Date();
  const errors: EnqueueDiagnosticEntry[] = [];

  const pipeline = schedule.pipeline;
  const steps = pipeline?.steps ?? [];
  const effectiveExecutionConfig = mergeExecutionConfig(
    pipeline?.executionConfig,
    schedule.executionConfig,
  );

  if (steps.length === 0) {
    logger.warn(
      { scheduleId: schedule.id, pipelineId: schedule.pipelineId },
      "Schedule pipeline has no steps, skipping",
    );
    await recordScheduleExecutionAndUpdateSchedule({
      db,
      schedule,
      executionTime,
      enqueueStatus: ScheduleEnqueueStatus.failed,
      runStatus: ScheduleRunStatus.failed,
      effectiveExecutionConfig,
      jobsCreated: 0,
      jobsEnqueued: 0,
      errors: [
        {
          message: "Pipeline has no steps",
          timestamp: executionTime.toISOString(),
          phase: "planning",
        },
      ],
    });
    return;
  }

  const planningResult = await planPipelineInvocations({
    db,
    pipeline: {
      id: schedule.pipelineId,
      domainIntegrationId: schedule.pipeline.domainIntegrationId,
      steps,
    },
    sourceId: schedule.id,
    expandStepInputs,
    variableSecretMasterKey,
    variableSecretFallbackMasterKey,
    requireHttpsAgentEndpoints,
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
  let jobsEnqueued = 0;

  const enqueueStatus =
    errors.length === 0
      ? ScheduleEnqueueStatus.success
      : jobsCreated > 0
        ? ScheduleEnqueueStatus.partial
        : ScheduleEnqueueStatus.failed;

  const initialRunStatus =
    jobsCreated === 0 ? ScheduleRunStatus.failed : ScheduleRunStatus.pending;

  const effectiveJson = toPrismaJson(effectiveExecutionConfig);

  if (jobsCreated === 0) {
    await recordScheduleExecutionAndUpdateSchedule({
      db,
      schedule,
      executionTime,
      enqueueStatus,
      runStatus: initialRunStatus,
      effectiveExecutionConfig: effectiveJson,
      jobsCreated: 0,
      jobsEnqueued: 0,
      errors: errors.length > 0 ? errors : undefined,
    });
    return;
  }

  const stepExpected = new Map<string, number>();
  for (const j of plannedJobs) {
    stepExpected.set(
      j.pipelineStepId,
      (stepExpected.get(j.pipelineStepId) ?? 0) + 1,
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
          scheduleExecutionId: "",
          scheduleId: schedule.id,
          pipelineId: schedule.pipelineId,
          pipelineStepId: job.pipelineStepId,
          domainIntegrationId: schedule.pipeline.domainIntegrationId,
          agentId: job.agentId,
          agentVersion: job.agentVersion,
          endpointUrl: job.endpointUrl,
          body: { input: job.input, config: job.config },
          timeoutMs: schedule.pipeline.timeout ?? defaultTimeoutMs,
          priority: schedule.priority,
        },
        dependsOnBatchIndices: useSequentialDeps
          ? [...lastWaveIndices]
          : undefined,
      });
    }
    if (enqueueItems.length > waveStart) {
      lastWaveIndices = Array.from(
        { length: enqueueItems.length - waveStart },
        (_, k) => waveStart + k,
      );
    }
  }

  const created = await db.$transaction(async (tx) => {
    const se = await tx.scheduleExecution.create({
      data: {
        scheduleId: schedule.id,
        executionTime,
        enqueueStatus,
        runStatus: initialRunStatus,
        effectiveExecutionConfig: effectiveJson,
        jobsCreated,
        jobsEnqueued: 0,
        errors:
          errors.length > 0 ? (errors as Prisma.InputJsonValue) : undefined,
      },
    });

    for (const [pipelineStepId, count] of stepExpected) {
      await tx.scheduleStepExecution.create({
        data: {
          scheduleExecutionId: se.id,
          pipelineStepId,
          expectedInvocationCount: count,
          succeededCount: 0,
          failedCount: 0,
          rollupStatus: ScheduleStepRollupStatus.pending,
        },
      });
    }

    for (const item of enqueueItems) {
      const p = item.payload;
      await tx.agentJobExecution.create({
        data: {
          jobId: p.jobId,
          agentId: p.agentId,
          scheduleId: schedule.id,
          scheduleExecutionId: se.id,
          pipelineId: schedule.pipelineId,
          pipelineStepId: p.pipelineStepId,
          status: AgentJobExecutionStatus.pending,
          priority: schedule.priority,
          enqueuedAt: executionTime,
          params: p.body.input as Prisma.InputJsonValue,
          invocationConfig: p.body.config as Prisma.InputJsonValue,
        },
      });
      p.scheduleExecutionId = se.id;
    }

    return se;
  });

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
      } catch (updateErr) {
        logger.error(
          { err: updateErr, jobId: item.payload.jobId },
          "Failed to update AgentJobExecution to failed after enqueue error",
        );
      }
    }
    await db.scheduleExecution.update({
      where: { id: created.id },
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
    await updateScheduleAfterExecution(db, schedule, executionTime);
    return;
  }

  await db.scheduleExecution.update({
    where: { id: created.id },
    data: {
      jobsEnqueued,
      enqueueStatus:
        errors.length === 0
          ? ScheduleEnqueueStatus.success
          : ScheduleEnqueueStatus.partial,
    },
  });

  await updateScheduleAfterExecution(db, schedule, executionTime);
};

function toPrismaJson(value: Record<string, unknown>): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

async function updateScheduleAfterExecution(
  db: PrismaClient,
  schedule: DueSchedule,
  executionTime: Date,
): Promise<void> {
  if (schedule.repeat === "once") {
    await db.schedule.update({
      where: { id: schedule.id },
      data: { enabled: false },
    });
    return;
  }

  const nextRunAt = computeNextRunAt(
    {
      repeat: schedule.repeat,
      cronExpression: schedule.cronExpression,
      interval: schedule.interval,
      timezone: schedule.timezone,
      nextRunAt: schedule.nextRunAt,
    },
    executionTime,
  );
  await db.schedule.update({
    where: { id: schedule.id },
    data: { nextRunAt },
  });
}

async function recordScheduleExecutionAndUpdateSchedule(args: {
  db: PrismaClient;
  schedule: DueSchedule;
  executionTime: Date;
  enqueueStatus: ScheduleEnqueueStatus;
  runStatus: ScheduleRunStatus;
  effectiveExecutionConfig: Prisma.InputJsonValue;
  jobsCreated: number;
  jobsEnqueued: number;
  errors?: EnqueueDiagnosticEntry[];
}): Promise<void> {
  const {
    db,
    schedule,
    executionTime,
    enqueueStatus,
    runStatus,
    effectiveExecutionConfig,
    jobsCreated,
    jobsEnqueued,
    errors,
  } = args;
  await db.scheduleExecution.create({
    data: {
      scheduleId: schedule.id,
      executionTime,
      enqueueStatus,
      runStatus,
      effectiveExecutionConfig,
      jobsCreated,
      jobsEnqueued,
      errors: errors ?? undefined,
    },
  });

  await updateScheduleAfterExecution(db, schedule, executionTime);
}
