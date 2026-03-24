import { randomUUID } from "node:crypto";
import {
  AgentJobExecutionStatus,
  Prisma,
  ScheduleEnqueueStatus,
  ScheduleRunStatus,
  ScheduleStepRollupStatus,
  type PrismaClient,
} from "@hermes/orchestration-database";
import { AgentEndpointSchema, substituteVariables } from "@hermes/scheduler";
import { mergeExecutionConfig } from "@hermes/scheduler";

import type { JobPayloadMap } from "./job-payload-map";

type ExecuteHttpTriggerDeps = {
  db: PrismaClient;
  enqueueAgentInvocations: (
    items: Array<{
      payload: JobPayloadMap["invoke_agent"];
      dependsOnBatchIndices?: number[];
    }>,
  ) => Promise<void>;
  defaultTimeoutMs?: number;
};

/**
 * Plans and enqueues pipeline agent invocations for an HTTP trigger execution.
 */
export const executeHttpTrigger = async (
  httpTriggerExecutionId: string,
  deps: ExecuteHttpTriggerDeps,
): Promise<void> => {
  const { db, enqueueAgentInvocations, defaultTimeoutMs = 300_000 } = deps;
  const execution = await db.httpTriggerExecution.findUnique({
    where: { id: httpTriggerExecutionId },
    include: {
      httpTrigger: {
        include: {
          pipeline: {
            include: {
              steps: {
                include: { agentConfig: true },
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
  const variables = await db.variable.findMany();
  const variableMap = new Map(variables.map((v) => [v.key, v.value]));
  const effectiveExecutionConfig = mergeExecutionConfig(
    pipeline.executionConfig,
    null,
  );
  const errors: Array<{ message: string; timestamp: string }> = [];

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
          },
        ],
      },
    });
    return;
  }

  const agentIds = [...new Set(steps.map((step) => step.agentId))];
  const agents = await db.agentRegistry.findMany({
    where: {
      agentId: { in: agentIds },
      isActive: true,
      domainIntegrationId: pipeline.domainIntegrationId,
    },
  });
  const agentByKey = new Map(
    agents.map((agent) => [`${agent.agentId}:${agent.agentVersion}`, agent]),
  );

  const waveList: Array<
    Array<{
      jobId: string;
      executionId: string;
      pipelineStepId: string;
      agentId: string;
      agentVersion: string;
      endpointUrl: string;
      input: Record<string, unknown>;
      config: Record<string, unknown>;
    }>
  > = [];

  for (const step of steps) {
    const stepJobs: Array<{
      jobId: string;
      executionId: string;
      pipelineStepId: string;
      agentId: string;
      agentVersion: string;
      endpointUrl: string;
      input: Record<string, unknown>;
      config: Record<string, unknown>;
    }> = [];
    const agent = agentByKey.get(`${step.agentId}:${step.agentVersion}`);
    if (!agent) {
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
    let stepConfig: Record<string, unknown>;
    if (step.agentConfigId != null && step.agentConfig != null) {
      stepConfig =
        step.agentConfig.config != null &&
        typeof step.agentConfig.config === "object" &&
        !Array.isArray(step.agentConfig.config)
          ? (step.agentConfig.config as Record<string, unknown>)
          : {};
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
    stepJobs.push({
      jobId: randomUUID(),
      executionId: randomUUID(),
      pipelineStepId: step.id,
      agentId: step.agentId,
      agentVersion: step.agentVersion,
      endpointUrl: endpointResult.data.url,
      input: inputSubstituted,
      config: stepConfig,
    });
    if (stepJobs.length > 0) waveList.push(stepJobs);
  }

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
          body: { input: job.input, config: job.config },
          timeoutMs: defaultTimeoutMs,
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

  await enqueueAgentInvocations(enqueueItems);
  await db.httpTriggerExecution.update({
    where: { id: httpTriggerExecutionId },
    data: {
      enqueueStatus:
        errors.length > 0
          ? ScheduleEnqueueStatus.partial
          : ScheduleEnqueueStatus.success,
      jobsEnqueued: enqueueItems.length,
      errors: errors.length > 0 ? (errors as Prisma.InputJsonValue) : undefined,
    },
  });
};
