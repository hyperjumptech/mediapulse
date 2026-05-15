import { prisma } from "@hermes/orchestration-database";
import {
  cancelScheduleExecution,
  type CancelScheduleExecutionResult,
} from "@hermes/scheduler";
import {
  createRequestValidator,
  errorResponse,
  type HandlerFunc,
  successResponse,
} from "route-action-gen/lib";
import { z } from "zod";

import { requireMutationDashboardPrincipalForRoute } from "@/lib/require-mutation-dashboard-principal-for-route";
import { getHermesJobQueue } from "@/lib/hermes-job-queue";

const bodyValidator = z.object({
  scheduleId: z.string().uuid(),
  scheduleExecutionId: z.string().uuid(),
});

export const requestValidator = createRequestValidator({
  body: bodyValidator,
  user: requireMutationDashboardPrincipalForRoute,
});

export const responseValidator = z.object({
  ok: z.literal(true),
});

type CancelScheduleExecutionHandler = HandlerFunc<
  typeof requestValidator,
  typeof responseValidator,
  undefined
>;

type Dependencies = {
  db?: typeof prisma;
  cancelExecution?: (
    db: typeof prisma,
    queue: ReturnType<typeof getHermesJobQueue>,
    scheduleExecutionId: string,
  ) => Promise<CancelScheduleExecutionResult>;
};

/**
 * Creates handler that cancels a schedule execution (DataQueue + orchestration).
 */
export const createCancelScheduleExecutionHandler = ({
  db = prisma,
  cancelExecution = cancelScheduleExecution,
}: Dependencies = {}): CancelScheduleExecutionHandler => {
  return async (data) => {
    const { scheduleId, scheduleExecutionId } = data.body;
    const execution = await db.scheduleExecution.findFirst({
      where: { id: scheduleExecutionId, scheduleId },
      select: { id: true },
    });
    if (!execution) {
      return errorResponse("Schedule execution not found");
    }

    const result = await cancelExecution(
      db,
      getHermesJobQueue(),
      scheduleExecutionId,
    );
    if (!result.ok) {
      if (result.reason === "already_terminal") {
        return errorResponse("Execution is already finished");
      }
      return errorResponse("Schedule execution not found");
    }

    return successResponse({ ok: true as const });
  };
};

export const handler: CancelScheduleExecutionHandler =
  createCancelScheduleExecutionHandler();
