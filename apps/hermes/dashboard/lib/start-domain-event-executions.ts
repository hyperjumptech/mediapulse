import { createHash, randomUUID } from "node:crypto";

import type { DomainEventRequest } from "@hermes/domain-contract";
import { prisma, type Prisma } from "@hermes/orchestration-database";
import { parseRunParams } from "@hermes/scheduler/run-params";

import { startHttpTriggerExecution } from "@/lib/start-http-trigger-execution";

type DomainEventDb = Pick<typeof prisma, "domainIntegration" | "httpTrigger">;

export type StartHttpTriggerExecutionFn = typeof startHttpTriggerExecution;

export type StartDomainEventExecutionsResult =
  | { status: "unauthorized" }
  | { status: "invalid_params"; message: string }
  | {
      status: "started";
      executions: Array<{ triggerId: string; executionId: string }>;
    };

const findDomainIntegrationIdByApiKey = async (
  apiKey: string,
  db: DomainEventDb,
): Promise<string | null> => {
  const credentialSha256Hex = createHash("sha256").update(apiKey).digest("hex");
  const integration = await db.domainIntegration.findFirst({
    where: { encryptedPayload: { credentialSha256Hex } },
    select: { id: true },
  });

  return integration?.id ?? null;
};

export const startDomainEventExecutions = async (
  {
    apiKey,
    request,
    requestId,
  }: {
    apiKey: string;
    request: DomainEventRequest;
    requestId: string | null;
  },
  {
    db = prisma,
    startExecution = startHttpTriggerExecution,
  }: {
    db?: DomainEventDb;
    startExecution?: StartHttpTriggerExecutionFn;
  } = {},
): Promise<StartDomainEventExecutionsResult> => {
  const domainIntegrationId = await findDomainIntegrationIdByApiKey(apiKey, db);
  if (domainIntegrationId === null) {
    return { status: "unauthorized" };
  }
  const runParams = parseRunParams(request.params);
  if (!runParams.success) {
    return { status: "invalid_params", message: runParams.error };
  }
  const triggerFindManyArgs = {
    where: {
      authType: "DOMAIN_EVENT",
      eventName: request.event,
      enabled: true,
      pipeline: { domainIntegrationId },
    },
    select: { id: true, pipeline: { select: { executionConfig: true } } },
    orderBy: { createdAt: "asc" },
  } satisfies Prisma.HttpTriggerFindManyArgs;
  const triggers = await db.httpTrigger.findMany(triggerFindManyArgs);
  const hasRunParams = Object.keys(runParams.params).length > 0;
  const executions: Array<{ triggerId: string; executionId: string }> = [];
  for (const trigger of triggers) {
    const executionId = await startExecution({
      triggerId: trigger.id,
      executionConfig: trigger.pipeline.executionConfig,
      metadata: { source: "domain-event", event: request.event },
      requestId: requestId ?? randomUUID(),
      runParams: hasRunParams ? runParams.params : null,
    });
    executions.push({ triggerId: trigger.id, executionId });
  }

  return { status: "started", executions };
};
