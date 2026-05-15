import { prisma } from "@hermes/orchestration-database";
import {
  createRequestValidator,
  errorResponse,
  HandlerFunc,
  successResponse,
} from "route-action-gen/lib";
import { z } from "zod";

import { requireDashboardPrincipalForRoute } from "@/lib/auth-dashboard";

const bodyValidator = z.object({
  scheduleId: z.string().uuid(),
});

export const requestValidator = createRequestValidator({
  body: bodyValidator,
  user: requireDashboardPrincipalForRoute,
});

export const responseValidator = z.object({
  ok: z.literal(true),
});

type DeleteScheduleHandlerDependencies = {
  db?: typeof prisma;
};

type DeleteScheduleHandler = HandlerFunc<
  typeof requestValidator,
  typeof responseValidator,
  undefined
>;

/**
 * Creates the delete-schedule handler with injectable dependencies for tests.
 *
 * @param dependencies - Optional db client for tests.
 * @returns Handler that deletes a schedule (cascades to schedule executions).
 */
export const createDeleteScheduleHandler = ({
  db = prisma,
}: DeleteScheduleHandlerDependencies = {}): DeleteScheduleHandler => {
  return async (data) => {
    const { scheduleId } = data.body;
    const existing = await db.schedule.findUnique({
      where: { id: scheduleId },
    });
    if (!existing) {
      return errorResponse("Schedule not found");
    }

    await db.schedule.delete({ where: { id: scheduleId } });

    return successResponse({ ok: true as const });
  };
};

/**
 * Handles delete schedule: validates session, verifies schedule exists, then deletes.
 */
export const handler: DeleteScheduleHandler = createDeleteScheduleHandler();
