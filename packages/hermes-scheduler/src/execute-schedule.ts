import {
  AgentJobExecutionStatus,
  ScheduleExecutionStatus,
  type PrismaClient,
} from "@workspace/database";
import { randomUUID } from "node:crypto";
import type { DueSchedule } from "./get-due-schedules";
import { expandDataSources } from "./expand-data-sources";
import { computeNextRunAt } from "./next-run-at";
import {
  AgentEndpointSchema,
  invokeAgent,
  type InvokeAgentHttpClient,
} from "./invoke-agent";

/** Dependencies for executeSchedule (injectable for tests). */
export type ExecuteScheduleDeps = {
  db: PrismaClient;
  httpClient: InvokeAgentHttpClient;
  logger: {
    info: (obj: unknown, msg?: string) => void;
    warn: (obj: unknown, msg?: string) => void;
    error: (obj: unknown, msg?: string) => void;
  };
  authToken?: string;
  defaultTimeoutMs?: number;
};

/**
 * Executes a due schedule: expands params, runs pipeline steps for each param set, records executions, and updates schedule state.
 *
 * @param schedule - Schedule with pipeline and steps (from getDueSchedules).
 * @param deps - DB, HTTP client, logger, auth, timeout.
 */
export const executeSchedule = async (
  schedule: DueSchedule,
  deps: ExecuteScheduleDeps,
): Promise<void> => {
  const {
    db,
    httpClient,
    logger,
    authToken,
    defaultTimeoutMs = 300_000,
  } = deps;
  const executionTime = new Date();
  const errors: Array<{ message: string; timestamp: string }> = [];
  let jobsCreated = 0;
  let jobsEnqueued = 0;

  const params = (schedule.params as Record<string, unknown>) ?? {};
  const paramSets = await expandDataSources(params, db);

  const pipeline = schedule.pipeline;
  const steps = pipeline?.steps ?? [];
  if (steps.length === 0) {
    logger.warn(
      { scheduleId: schedule.id, pipelineId: schedule.pipelineId },
      "Schedule pipeline has no steps, skipping",
    );
    await recordScheduleExecutionAndUpdateSchedule({
      db,
      schedule,
      executionTime,
      status: ScheduleExecutionStatus.failed,
      jobsCreated: 0,
      jobsEnqueued: 0,
      errors: [
        {
          message: "Pipeline has no steps",
          timestamp: executionTime.toISOString(),
        },
      ],
    });
    return;
  }

  const agentIds: string[] = [
    ...new Set(steps.map((s: { agentId: string }) => s.agentId)),
  ];
  const agents = await db.agentRegistry.findMany({
    where: { agentId: { in: agentIds }, isActive: true },
  });
  const agentByKey = new Map(
    agents.map((a) => [`${a.agentId}:${a.agentVersion}`, a]),
  );

  for (const paramSet of paramSets) {
    for (const step of steps) {
      const agent = agentByKey.get(`${step.agentId}:${step.agentVersion}`);
      if (!agent) {
        logger.warn(
          { agentId: step.agentId, agentVersion: step.agentVersion },
          "Agent not found in registry, skipping step",
        );
        errors.push({
          message: `Agent ${step.agentId}@${step.agentVersion} not found`,
          timestamp: new Date().toISOString(),
        });
        continue;
      }

      const endpointResult = AgentEndpointSchema.safeParse(agent.endpoint);
      if (!endpointResult.success) {
        errors.push({
          message: `Invalid endpoint for ${step.agentId}: ${endpointResult.error.message}`,
          timestamp: new Date().toISOString(),
        });
        continue;
      }

      const jobId = randomUUID();
      const executionId = randomUUID();
      jobsCreated += 1;

      try {
        await db.agentJobExecution.create({
          data: {
            jobId,
            agentId: step.agentId,
            scheduleId: schedule.id,
            pipelineId: schedule.pipelineId,
            pipelineStepId: step.id,
            status: AgentJobExecutionStatus.pending,
            priority: schedule.priority,
            enqueuedAt: executionTime,
            params: paramSet as object,
          },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push({
          message: `Failed to create AgentJobExecution: ${message}`,
          timestamp: new Date().toISOString(),
        });
        continue;
      }

      const stepConfig =
        (step as { config?: unknown }).config != null
          ? (step as { config: Record<string, unknown> }).config
          : {};
      const body = {
        input: paramSet,
        config: stepConfig,
      } as Record<string, unknown>;

      try {
        await invokeAgent(
          endpointResult.data,
          body,
          {
            jobId,
            executionId,
            authToken,
            timeoutMs: schedule.timeout ?? defaultTimeoutMs,
          },
          httpClient,
        );
        jobsEnqueued += 1;
        await db.agentJobExecution.update({
          where: { jobId },
          data: {
            status: AgentJobExecutionStatus.running,
            startedAt: new Date(),
          },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push({
          message: `Agent invoke failed: ${message}`,
          timestamp: new Date().toISOString(),
        });
        await db.agentJobExecution
          .update({
            where: { jobId },
            data: {
              status: AgentJobExecutionStatus.failed,
              error: { message, retryable: true },
              completedAt: new Date(),
            },
          })
          .catch(() => {});
      }
    }
  }

  const status =
    errors.length === 0
      ? ScheduleExecutionStatus.success
      : jobsEnqueued > 0
        ? ScheduleExecutionStatus.partial
        : ScheduleExecutionStatus.failed;

  await recordScheduleExecutionAndUpdateSchedule({
    db,
    schedule,
    executionTime,
    status,
    jobsCreated,
    jobsEnqueued,
    errors: errors.length > 0 ? errors : undefined,
  });
};

async function recordScheduleExecutionAndUpdateSchedule(args: {
  db: PrismaClient;
  schedule: DueSchedule;
  executionTime: Date;
  status: ScheduleExecutionStatus;
  jobsCreated: number;
  jobsEnqueued: number;
  errors?: Array<{ message: string; timestamp: string }>;
}): Promise<void> {
  const {
    db,
    schedule,
    executionTime,
    status,
    jobsCreated,
    jobsEnqueued,
    errors,
  } = args;
  await db.scheduleExecution.create({
    data: {
      scheduleId: schedule.id,
      executionTime,
      status,
      jobsCreated,
      jobsEnqueued,
      errors: errors ?? undefined,
    },
  });

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
