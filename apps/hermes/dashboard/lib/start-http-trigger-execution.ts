import {
  prisma,
  type Prisma,
  ScheduleEnqueueStatus,
} from "@hermes/orchestration-database";
import { mergeHermesEnqueueCorrelationIntoMetadata } from "@hermes/scheduler/enqueue-diagnostics-correlation";
import type { RunParams } from "@hermes/scheduler/run-params";

import { getHermesJobQueue } from "@/lib/hermes-job-queue";

export type StartHttpTriggerExecutionArgs = {
  triggerId: string;
  executionConfig: Prisma.JsonValue | null;
  metadata: Record<string, unknown>;
  requestId: string;
  runParams: RunParams | null;
};

export type StartHttpTriggerExecutionDeps = {
  db?: Pick<typeof prisma, "httpTrigger" | "httpTriggerExecution">;
  jobQueue?: Pick<ReturnType<typeof getHermesJobQueue>, "addJob">;
};

export const startHttpTriggerExecution = async (
  {
    triggerId,
    executionConfig,
    metadata,
    requestId,
    runParams,
  }: StartHttpTriggerExecutionArgs,
  {
    db = prisma,
    jobQueue = getHermesJobQueue(),
  }: StartHttpTriggerExecutionDeps = {},
): Promise<string> => {
  const metadataWithCorrelation = mergeHermesEnqueueCorrelationIntoMetadata(
    metadata,
    { requestId },
  ) as Prisma.InputJsonValue;
  const execution = await db.httpTriggerExecution.create({
    data: {
      httpTriggerId: triggerId,
      executionTime: new Date(),
      enqueueStatus: ScheduleEnqueueStatus.success,
      jobsCreated: 0,
      jobsEnqueued: 0,
      effectiveExecutionConfig:
        executionConfig != null
          ? (executionConfig as Prisma.InputJsonValue)
          : undefined,
      metadata: metadataWithCorrelation,
      runParams: runParams ?? undefined,
    },
    select: { id: true },
  });
  await db.httpTrigger.update({
    where: { id: triggerId },
    data: { lastTriggeredAt: new Date() },
  });
  const workerJobId = await jobQueue.addJob({
    jobType: "execute_http_trigger",
    payload: { httpTriggerExecutionId: execution.id },
    idempotencyKey: `execute_http_trigger:${execution.id}`,
    tags: [`httpTriggerExecution:${execution.id}`],
  });
  await db.httpTriggerExecution.update({
    where: { id: execution.id },
    data: {
      metadata: mergeHermesEnqueueCorrelationIntoMetadata(
        metadataWithCorrelation,
        { workerTickId: String(workerJobId) },
      ) as Prisma.InputJsonValue,
    },
  });

  return execution.id;
};
