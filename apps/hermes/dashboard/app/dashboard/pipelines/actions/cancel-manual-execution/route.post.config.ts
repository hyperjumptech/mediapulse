import { prisma } from "@hermes/orchestration-database";
import {
  createRequestValidator,
  errorResponse,
  type HandlerFunc,
  successResponse,
} from "route-action-gen/lib";
import { z } from "zod";

import { requireMutationDashboardPrincipalForRoute } from "@/lib/require-mutation-dashboard-principal-for-route";
import { abortManualPipelineRunIfLocal } from "@/lib/manual-pipeline-run-abort";
import {
  finalizeManualPipelineExecutionAfterCooperativeCancel,
  loadManualPipelineFinalizeSnapshotFromDb,
  markManualPipelineExecutionCancelled,
} from "@hermes/scheduler";

const bodyValidator = z.object({
  pipelineId: z.string().uuid(),
  manualExecutionId: z.string().uuid(),
});

export const requestValidator = createRequestValidator({
  body: bodyValidator,
  user: requireMutationDashboardPrincipalForRoute,
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
  loadFinalizeSnapshot?: typeof loadManualPipelineFinalizeSnapshotFromDb;
  finalizeAfterCancel?: typeof finalizeManualPipelineExecutionAfterCooperativeCancel;
  abortLocal?: (manualExecutionId: string) => void;
};

/**
 * Marks a manual pipeline run as cancelled and best-effort aborts local HTTP.
 * Any authenticated dashboard admin may cancel; execution must belong to `pipelineId`.
 */
export const createCancelManualExecutionHandler = ({
  db = prisma,
  markCancelled = markManualPipelineExecutionCancelled,
  loadFinalizeSnapshot = loadManualPipelineFinalizeSnapshotFromDb,
  finalizeAfterCancel = finalizeManualPipelineExecutionAfterCooperativeCancel,
  abortLocal = abortManualPipelineRunIfLocal,
}: Dependencies = {}): CancelManualExecutionHandler => {
  return async (data) => {
    const { pipelineId, manualExecutionId } = data.body;

    const execution = await db.manualPipelineExecution.findFirst({
      where: { id: manualExecutionId, pipelineId },
      select: { id: true },
    });
    if (!execution) {
      return errorResponse("Manual execution not found");
    }

    const result = await markCancelled(db, manualExecutionId);
    if (!result.ok) {
      if (result.reason === "already_terminal") {
        return errorResponse("Execution is already finished");
      }
      return errorResponse("Manual execution not found");
    }

    const snapshot = await loadFinalizeSnapshot(db, manualExecutionId);
    await finalizeAfterCancel(db, {
      manualExecutionId,
      plannedJobs: snapshot.plannedJobs,
      processedJobIds: snapshot.processedJobIds,
      source: "dbSnapshot",
    });

    abortLocal(manualExecutionId);

    return successResponse({ ok: true as const });
  };
};

export const handler: CancelManualExecutionHandler =
  createCancelManualExecutionHandler();
