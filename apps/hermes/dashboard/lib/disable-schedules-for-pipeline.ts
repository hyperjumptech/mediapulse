import { prisma } from "@hermes/orchestration-database";

import { getPipelineWithSteps } from "@/lib/pipelines";
import { getPipelineStatus, validatePipeline } from "@/lib/validate-pipeline";

type Db = typeof prisma;

/**
 * If the pipeline is not enabled (inactive or validation invalid), disables all
 * schedules that reference it so hermes-scheduler will not run them.
 *
 * @param db - Prisma client (injectable for tests).
 * @param pipelineId - Pipeline to check.
 * @returns Promise that resolves when done (no return value).
 */
export async function disableSchedulesForPipelineIfNotEnabled(
  db: Db,
  pipelineId: string,
): Promise<void> {
  const pipeline = await getPipelineWithSteps(pipelineId, db);
  if (!pipeline) return;
  const validation = await validatePipeline(pipeline, db);
  if (getPipelineStatus(pipeline, validation) !== "enabled") {
    await db.schedule.updateMany({
      where: { pipelineId },
      data: { enabled: false },
    });
  }
}
