import type { PrismaClient } from "@hermes/orchestration-database";

import { executionDetailHref } from "./execution-list";

export type ResolveExecutionHrefDb = {
  scheduleExecution: Pick<PrismaClient["scheduleExecution"], "findUnique">;
  httpTriggerExecution: Pick<
    PrismaClient["httpTriggerExecution"],
    "findUnique"
  >;
  manualPipelineExecution: Pick<
    PrismaClient["manualPipelineExecution"],
    "findUnique"
  >;
};

export const resolveExecutionHref = async (
  executionId: string,
  db: ResolveExecutionHrefDb,
): Promise<string | null> => {
  const [scheduleExecution, httpTriggerExecution, manualExecution] =
    await Promise.all([
      db.scheduleExecution.findUnique({
        where: { id: executionId },
        select: { scheduleId: true },
      }),
      db.httpTriggerExecution.findUnique({
        where: { id: executionId },
        select: { httpTriggerId: true },
      }),
      db.manualPipelineExecution.findUnique({
        where: { id: executionId },
        select: { pipelineId: true },
      }),
    ]);
  if (scheduleExecution) {
    return executionDetailHref({
      id: executionId,
      source: "schedule",
      sourceId: scheduleExecution.scheduleId,
    });
  }
  if (httpTriggerExecution) {
    return executionDetailHref({
      id: executionId,
      source: "http-trigger",
      sourceId: httpTriggerExecution.httpTriggerId,
    });
  }
  if (manualExecution) {
    return executionDetailHref({
      id: executionId,
      source: "manual",
      sourceId: manualExecution.pipelineId,
    });
  }

  return null;
};
