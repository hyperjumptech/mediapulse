import { prisma } from "@hermes/orchestration-database";
import {
  createRequestValidator,
  HandlerFunc,
  successResponse,
} from "route-action-gen/lib";
import { z } from "zod";

import { requireDashboardSessionForRoute } from "@/lib/auth-dashboard";
import { disableSchedulesForPipelineIfNotEnabled } from "@/lib/disable-schedules-for-pipeline";

const stepIdsSchema = z.union([
  z.array(z.string().uuid()),
  z.string().transform((s): string[] => {
    try {
      const parsed = JSON.parse(s) as unknown;
      return Array.isArray(parsed)
        ? parsed.filter((id): id is string => typeof id === "string")
        : [];
    } catch {
      return [];
    }
  }),
]);

const bodyValidator = z.object({
  pipelineId: z.string().uuid(),
  stepIds: stepIdsSchema,
});

export const requestValidator = createRequestValidator({
  body: bodyValidator,
  user: requireDashboardSessionForRoute,
});

export const responseValidator = z.object({
  ok: z.literal(true),
});

type ReorderStepsHandlerDependencies = {
  db?: typeof prisma;
};

type ReorderStepsHandler = HandlerFunc<
  typeof requestValidator,
  typeof responseValidator,
  undefined
>;

/**
 * Creates the reorder-steps handler with injectable dependencies for tests.
 *
 * @param dependencies - Optional db client for tests.
 * @returns Handler that updates each step's order by index in stepIds.
 */
export const createReorderStepsHandler = ({
  db = prisma,
}: ReorderStepsHandlerDependencies = {}): ReorderStepsHandler => {
  return async (data) => {
    const { pipelineId, stepIds } = data.body;

    if (stepIds.length === 0) {
      return successResponse({ ok: true as const });
    }

    const offset = 10000;
    for (let i = 0; i < stepIds.length; i++) {
      await db.pipelineStep.updateMany({
        where: { id: stepIds[i], pipelineId },
        data: { order: offset + i },
      });
    }
    for (let i = 0; i < stepIds.length; i++) {
      await db.pipelineStep.updateMany({
        where: { id: stepIds[i], pipelineId },
        data: { order: i },
      });
    }

    await disableSchedulesForPipelineIfNotEnabled(db, pipelineId);

    return successResponse({ ok: true as const });
  };
};

/**
 * Handles reorder pipeline steps: validates session, updates step order by index.
 */
export const handler: ReorderStepsHandler = createReorderStepsHandler();
