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
  type AgentEndpoint,
  type InvokeAgentHttpClient,
} from "./invoke-agent";
import { substituteVariables } from "./substitute-variables";
import { validateWithJsonSchema } from "./validate-json-schema";

/**
 * Payload for an enqueued invoke_agent_step job. Used so the worker can invoke
 * the agent when the job runs; hermes-scheduler stays agnostic of DataQueue.
 */
export type InvokeAgentStepPayload = {
  jobId: string;
  executionId: string;
  scheduleExecutionId: string;
  endpoint: AgentEndpoint;
  body: { input: Record<string, unknown>; config: Record<string, unknown> };
  timeoutMs: number;
};

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
  /**
   * When set, each expanded input set is enqueued via this callback instead of
   * invoking the agent inline. Used by the worker to push DataQueue jobs.
   */
  enqueueAgentJob?: (payload: InvokeAgentStepPayload) => Promise<void>;
};

/**
 * Executes a due schedule: for each pipeline step, substitutes variables and expands
 * data sources in the step's input, then runs that step once per expanded input set.
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
    enqueueAgentJob,
  } = deps;
  const executionTime = new Date();
  const errors: Array<{ message: string; timestamp: string }> = [];
  let jobsCreated = 0;
  let jobsEnqueued = 0;

  const variables = await db.variable.findMany();
  const variableMap = new Map(variables.map((v) => [v.key, v.value]));

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

  const scheduleExecution = await db.scheduleExecution.create({
    data: {
      scheduleId: schedule.id,
      executionTime,
      status: ScheduleExecutionStatus.enqueuing,
      jobsCreated: 0,
      jobsEnqueued: 0,
    },
  });
  const scheduleExecutionId = scheduleExecution.id;

  const agentIds: string[] = [
    ...new Set(steps.map((s: { agentId: string }) => s.agentId)),
  ];
  const agents = await db.agentRegistry.findMany({
    where: { agentId: { in: agentIds }, isActive: true },
  });
  const agentByKey = new Map(
    agents.map((a) => [`${a.agentId}:${a.agentVersion}`, a]),
  );

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

    const stepWithInput = step as { input?: unknown };
    const rawInput =
      stepWithInput.input != null &&
      typeof stepWithInput.input === "object" &&
      !Array.isArray(stepWithInput.input)
        ? (stepWithInput.input as Record<string, unknown>)
        : {};
    const inputSubstituted = substituteVariables(
      rawInput,
      variableMap,
    ) as Record<string, unknown>;
    const inputSchema =
      agent.inputSchema != null && typeof agent.inputSchema === "object"
        ? (agent.inputSchema as Record<string, unknown>)
        : null;
    if (inputSchema) {
      const result = validateWithJsonSchema(inputSchema, inputSubstituted);
      if (!result.valid) {
        errors.push({
          message: `Step input invalid for ${step.agentId}@${step.agentVersion}: ${result.errors.join("; ")}`,
          timestamp: new Date().toISOString(),
        });
        continue;
      }
    }
    const inputSets = await expandDataSources(inputSubstituted, db);

    let stepConfig: Record<string, unknown>;
    const stepWithConfig = step as {
      config?: unknown;
      agentConfigId?: string | null;
      agentConfig?: { config: unknown } | null;
    };
    if (
      stepWithConfig.agentConfigId != null &&
      stepWithConfig.agentConfig != null
    ) {
      const referencedConfig = stepWithConfig.agentConfig.config;
      const configObj =
        referencedConfig != null &&
        typeof referencedConfig === "object" &&
        !Array.isArray(referencedConfig)
          ? (referencedConfig as Record<string, unknown>)
          : {};
      stepConfig = configObj;
    } else {
      stepConfig =
        stepWithConfig.config != null &&
        typeof stepWithConfig.config === "object" &&
        !Array.isArray(stepWithConfig.config)
          ? (stepWithConfig.config as Record<string, unknown>)
          : {};
    }
    stepConfig = substituteVariables(stepConfig, variableMap) as Record<
      string,
      unknown
    >;
    const configSchema =
      agent.configSchema != null && typeof agent.configSchema === "object"
        ? (agent.configSchema as Record<string, unknown>)
        : null;
    if (configSchema) {
      const result = validateWithJsonSchema(configSchema, stepConfig);
      if (!result.valid) {
        errors.push({
          message: `Step config invalid for ${step.agentId}@${step.agentVersion}: ${result.errors.join("; ")}`,
          timestamp: new Date().toISOString(),
        });
        continue;
      }
    }

    for (const inputSet of inputSets) {
      const jobId = randomUUID();
      const executionId = randomUUID();
      jobsCreated += 1;

      try {
        await db.agentJobExecution.create({
          data: {
            jobId,
            agentId: step.agentId,
            scheduleId: schedule.id,
            scheduleExecutionId,
            pipelineId: schedule.pipelineId,
            pipelineStepId: step.id,
            status: AgentJobExecutionStatus.pending,
            priority: schedule.priority,
            enqueuedAt: executionTime,
            params: inputSet as object,
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

      const body = {
        input: inputSet,
        config: stepConfig,
      } as Record<string, unknown>;
      const timeoutMs = schedule.timeout ?? defaultTimeoutMs;

      if (enqueueAgentJob) {
        try {
          await enqueueAgentJob({
            jobId,
            executionId,
            scheduleExecutionId,
            endpoint: endpointResult.data,
            body: body as {
              input: Record<string, unknown>;
              config: Record<string, unknown>;
            },
            timeoutMs,
          });
          jobsEnqueued += 1;
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          errors.push({
            message: `Enqueue agent job failed: ${message}`,
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
      } else {
        try {
          await invokeAgent(
            endpointResult.data,
            body,
            {
              jobId,
              executionId,
              authToken,
              timeoutMs,
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
    scheduleExecutionId,
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
  /** When set, update this row instead of creating a new one (used when we created it at run start). */
  scheduleExecutionId?: string;
}): Promise<void> {
  const {
    db,
    schedule,
    executionTime,
    status,
    jobsCreated,
    jobsEnqueued,
    errors,
    scheduleExecutionId,
  } = args;
  if (scheduleExecutionId) {
    await db.scheduleExecution.update({
      where: { id: scheduleExecutionId },
      data: {
        status,
        jobsCreated,
        jobsEnqueued,
        errors: errors ?? undefined,
      },
    });
  } else {
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
  }

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
