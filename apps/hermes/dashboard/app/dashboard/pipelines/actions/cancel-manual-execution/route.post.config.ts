import { prisma } from "@hermes/orchestration-database";
import {
  createRequestValidator,
  errorResponse,
  type HandlerFunc,
  successResponse,
} from "route-action-gen/lib";
import { z } from "zod";

import { requireDashboardSessionForRoute } from "@/lib/auth-dashboard";
import { abortManualPipelineRunIfLocal } from "@/lib/manual-pipeline-run-abort";
import { markManualPipelineExecutionCancelled } from "@hermes/scheduler";

const bodyValidator = z.object({
  pipelineId: z.string().uuid(),
  manualExecutionId: z.string().uuid(),
});

export const requestValidator = createRequestValidator({
  body: bodyValidator,
  user: requireDashboardSessionForRoute,
});

export const responseValidator = z.object({
  ok: z.literal(true),
});

type CancelManualExecutionHandler = HandlerFunc<
  typeof requestValidator,
  typeof responseValidator,
  undefined
>;

type Dependencies = {
  db?: typeof prisma;
  markCancelled?: typeof markManualPipelineExecutionCancelled;
  abortLocal?: (manualExecutionId: string) => void;
};

/**
 * Marks a manual pipeline run as cancelled and best-effort aborts local HTTP.
 */
export const createCancelManualExecutionHandler = ({
  db = prisma,
  markCancelled = markManualPipelineExecutionCancelled,
  abortLocal = abortManualPipelineRunIfLocal,
}: Dependencies = {}): CancelManualExecutionHandler => {
  return async (data) => {
    const { pipelineId, manualExecutionId } = data.body;
    const sessionUserId = data.user.id;

    const execution = await db.manualPipelineExecution.findFirst({
      where: { id: manualExecutionId, pipelineId },
      select: {
        id: true,
        metadata: true,
      },
    });
    if (!execution) {
      return errorResponse("Manual execution not found");
    }

    const meta = execution.metadata;
    const initiatedBy =
      meta != null &&
      typeof meta === "object" &&
      !Array.isArray(meta) &&
      typeof (meta as Record<string, unknown>).initiatedByUserId === "string"
        ? ((meta as Record<string, unknown>).initiatedByUserId as string)
        : null;
    if (initiatedBy !== sessionUserId) {
      return errorResponse("Not allowed to cancel this execution");
    }

    const result = await markCancelled(db, manualExecutionId);
    if (!result.ok) {
      if (result.reason === "already_terminal") {
        return errorResponse("Execution is already finished");
      }
      return errorResponse("Manual execution not found");
    }

    abortLocal(manualExecutionId);

    return successResponse({ ok: true as const });
  };
};

export const handler: CancelManualExecutionHandler =
  createCancelManualExecutionHandler();
