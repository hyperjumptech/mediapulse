import { prisma } from "@workspace/database";
import {
  createRequestValidator,
  errorResponse,
  HandlerFunc,
  successResponse,
} from "route-action-gen/lib";
import { z } from "zod";

import {
  getDashboardSession,
  getDashboardSessionForRoute,
} from "@/lib/auth-dashboard";

const bodyValidator = z.object({
  scheduleId: z.string().uuid(),
});

export const requestValidator = createRequestValidator({
  body: bodyValidator,
  user: getDashboardSessionForRoute,
});

export const responseValidator = z.object({
  ok: z.literal(true),
});

type DeleteScheduleHandlerDependencies = {
  getSession?: typeof getDashboardSession;
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
 * @param dependencies - Optional getSession and db.
 * @returns Handler that deletes a schedule (cascades to schedule executions).
 */
export const createDeleteScheduleHandler = ({
  getSession = getDashboardSession,
  db = prisma,
}: DeleteScheduleHandlerDependencies = {}): DeleteScheduleHandler => {
  return async (data) => {
    const session = await getSession();
    if (!session) {
      return errorResponse("Unauthorized");
    }

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
