import { prisma as mediapulsePrisma } from "@mediapulse/database";
import type { Prisma } from "@mediapulse/database";

/** Outcome filter values aligned with {@link Prisma.DeliveryRunScalarFieldEnum.outcome}. */
export type DeliveryRunOutcomeFilter =
  | "success"
  | "skipped"
  | "failed"
  | "partial_success";

/**
 * Lists delivery diagnostic runs with optional ticker, outcome, and time range filters.
 * `start` / `end` filter `createdAt` with `gte` / `lte` independently when provided.
 *
 * @param query - Filter fields from the agent-data-api contract.
 * @returns Rows newest first, including ticker symbol when joined.
 */
export async function listDeliveryRuns(query: {
  tickerId?: string;
  outcome?: DeliveryRunOutcomeFilter;
  start?: Date;
  end?: Date;
}) {
  const createdAtFilter =
    query.start !== undefined || query.end !== undefined
      ? {
          createdAt: {
            ...(query.start !== undefined ? { gte: query.start } : {}),
            ...(query.end !== undefined ? { lte: query.end } : {}),
          },
        }
      : {};

  const where = {
    ...(query.tickerId !== undefined ? { tickerId: query.tickerId } : {}),
    ...(query.outcome !== undefined ? { outcome: query.outcome } : {}),
    ...createdAtFilter,
  } satisfies Prisma.DeliveryRunWhereInput;

  const findManyArgs = {
    where,
    include: { ticker: { select: { symbol: true } } },
    orderBy: { createdAt: "desc" as const },
  } satisfies Prisma.DeliveryRunFindManyArgs;

  return mediapulsePrisma.deliveryRun.findMany(findManyArgs);
}

/**
 * Persists one delivery run and its per-recipient outcomes (transactional).
 *
 * @param data - Validated POST body from the delivery agent.
 */
export async function createDeliveryRun(data: {
  id: string;
  agentId: string;
  agentVersion: string;
  tickerId: string;
  newsletterId: string | null | undefined;
  outcome: DeliveryRunOutcomeFilter;
  stage:
    | "fetch"
    | "render"
    | "send"
    | "persist_delivery_record"
    | null
    | undefined;
  successCount: number;
  failureCount: number;
  skippedCount: number;
  durationMs: number;
  scheduleExecutionId: string | null | undefined;
  hermesScheduleId: string | null | undefined;
  pipelineStepId: string | null | undefined;
  jobId: string | null | undefined;
  hermesExecutionId: string | null | undefined;
  runSkipReason: string | null | undefined;
  resendMessageIds: string[] | undefined;
  recipientErrorSummary: string | null | undefined;
  recipients: Array<{
    userTickerId: string;
    status: string;
    attempts: number;
    lastErrorCode: string | null | undefined;
    lastErrorMessage: string | null | undefined;
    errorCategory: string | null | undefined;
    resendEmailId: string | null | undefined;
  }>;
  createdAt: Date;
}) {
  await mediapulsePrisma.deliveryRun.create({
    data: {
      id: data.id,
      agentId: data.agentId,
      agentVersion: data.agentVersion,
      tickerId: data.tickerId,
      newsletterId: data.newsletterId ?? null,
      outcome: data.outcome,
      stage: data.stage ?? null,
      successCount: data.successCount,
      failureCount: data.failureCount,
      skippedCount: data.skippedCount,
      durationMs: data.durationMs,
      scheduleExecutionId: data.scheduleExecutionId ?? null,
      hermesScheduleId: data.hermesScheduleId ?? null,
      pipelineStepId: data.pipelineStepId ?? null,
      jobId: data.jobId ?? null,
      hermesExecutionId: data.hermesExecutionId ?? null,
      runSkipReason: data.runSkipReason ?? null,
      resendMessageIds:
        data.resendMessageIds !== undefined ? data.resendMessageIds : undefined,
      recipientErrorSummary: data.recipientErrorSummary ?? null,
      createdAt: data.createdAt,
      recipients: {
        create: data.recipients.map((r) => ({
          userTickerId: r.userTickerId,
          status: r.status,
          attempts: r.attempts,
          lastErrorCode: r.lastErrorCode ?? null,
          lastErrorMessage: r.lastErrorMessage ?? null,
          errorCategory: r.errorCategory ?? null,
          resendEmailId: r.resendEmailId ?? null,
        })),
      },
    },
  });
}
