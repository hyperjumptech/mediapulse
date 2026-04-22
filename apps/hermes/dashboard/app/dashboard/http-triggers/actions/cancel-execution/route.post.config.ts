import { prisma } from "@hermes/orchestration-database";
import {
  cancelHttpTriggerExecution,
  type CancelHttpTriggerExecutionResult,
} from "@hermes/scheduler";
import {
  createRequestValidator,
  errorResponse,
  type HandlerFunc,
  successResponse,
} from "route-action-gen/lib";
import { z } from "zod";

import { requireDashboardSessionForRoute } from "@/lib/auth-dashboard";
import { getHermesJobQueue } from "@/lib/hermes-job-queue";

const bodyValidator = z.object({
  httpTriggerId: z.string().uuid(),
  httpTriggerExecutionId: z.string().uuid(),
});

export const requestValidator = createRequestValidator({
  body: bodyValidator,
  user: requireDashboardSessionForRoute,
});

export const responseValidator = z.object({
  ok: z.literal(true),
});

type CancelHttpTriggerExecutionHandler = HandlerFunc<
  typeof requestValidator,
  typeof responseValidator,
  undefined
>;

type Dependencies = {
  db?: typeof prisma;
  cancelExecution?: (
    db: typeof prisma,
    queue: ReturnType<typeof getHermesJobQueue>,
    httpTriggerExecutionId: string,
  ) => Promise<CancelHttpTriggerExecutionResult>;
};

/**
 * Creates handler that cancels an HTTP trigger execution (DataQueue + orchestration).
 */
export const createCancelHttpTriggerExecutionHandler = ({
  db = prisma,
  cancelExecution = cancelHttpTriggerExecution,
}: Dependencies = {}): CancelHttpTriggerExecutionHandler => {
  return async (data) => {
    const { httpTriggerId, httpTriggerExecutionId } = data.body;
    const execution = await db.httpTriggerExecution.findFirst({
      where: { id: httpTriggerExecutionId, httpTriggerId },
      select: { id: true },
    });
    if (!execution) {
      return errorResponse("HTTP trigger execution not found");
    }

    const result = await cancelExecution(
      db,
      getHermesJobQueue(),
      httpTriggerExecutionId,
    );
    if (!result.ok) {
      if (result.reason === "already_terminal") {
        return errorResponse("Execution is already finished");
      }
      return errorResponse("HTTP trigger execution not found");
    }

    return successResponse({ ok: true as const });
  };
};

export const handler: CancelHttpTriggerExecutionHandler =
  createCancelHttpTriggerExecutionHandler();
