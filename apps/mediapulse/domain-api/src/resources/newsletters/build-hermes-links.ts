import type { Prisma, prisma } from "@mediapulse/database";

/**
 * Shape of the Hermes-links section of the newsletter detail payload.
 * Every field can be `null` when the underlying run row didn't carry that id
 * (or no run exists yet).
 */
export type HermesLinksPayload = {
  contentGenerationRunId: string | null;
  hermesScheduleId: string | null;
  scheduleExecutionId: string | null;
  hermesExecutionId: string | null;
  pipelineStepId: string | null;
  pipelineRunId: string | null;
  jobIds: string[];
  deliveryRunIds: string[];
};

/** Prisma collaborator surface for {@link buildHermesLinks}. */
export type BuildHermesLinksDeps = {
  contentGenerationRun: Pick<typeof prisma.contentGenerationRun, "findFirst">;
  deliveryRun: Pick<typeof prisma.deliveryRun, "findMany">;
};

/**
 * Builds the Hermes-links payload by joining the latest
 * {@link prisma.contentGenerationRun} with all
 * {@link prisma.deliveryRun} rows for this newsletter (ordered newest first).
 *
 * Schedule/execution/pipeline ids prefer the latest delivery run when present
 * (those ids are populated at send time); `contentGenerationRunId` and
 * `pipelineRunId` come from the content-generation row.
 *
 * @param newsletterId - Newsletter id to look up.
 * @param deps - Prisma delegate collaborators.
 * @returns Aggregated Hermes-links payload.
 */
export const buildHermesLinks = async (
  newsletterId: string,
  deps: BuildHermesLinksDeps,
): Promise<HermesLinksPayload> => {
  const cgArgs = {
    where: { newsletterId },
    orderBy: { createdAt: "desc" as const },
    select: {
      id: true,
      pipelineRunId: true,
      executionId: true,
    },
  } satisfies Prisma.ContentGenerationRunFindFirstArgs;

  const deliveryArgs = {
    where: { newsletterId },
    orderBy: { createdAt: "desc" as const },
    select: {
      id: true,
      hermesScheduleId: true,
      scheduleExecutionId: true,
      hermesExecutionId: true,
      pipelineStepId: true,
      jobId: true,
    },
  } satisfies Prisma.DeliveryRunFindManyArgs;

  const [contentRun, deliveryRuns] = await Promise.all([
    deps.contentGenerationRun.findFirst(cgArgs),
    deps.deliveryRun.findMany(deliveryArgs),
  ]);

  const latest = deliveryRuns[0];
  const jobIds = Array.from(
    new Set(
      deliveryRuns
        .map((run) => run.jobId)
        .filter((value): value is string => value !== null && value !== ""),
    ),
  );

  return {
    contentGenerationRunId: contentRun?.id ?? null,
    pipelineRunId: contentRun?.pipelineRunId ?? null,
    hermesExecutionId:
      latest?.hermesExecutionId ?? contentRun?.executionId ?? null,
    hermesScheduleId: latest?.hermesScheduleId ?? null,
    scheduleExecutionId: latest?.scheduleExecutionId ?? null,
    pipelineStepId: latest?.pipelineStepId ?? null,
    jobIds,
    deliveryRunIds: deliveryRuns.map((run) => run.id),
  };
};
