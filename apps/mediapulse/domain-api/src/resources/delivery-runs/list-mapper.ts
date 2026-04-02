import type { Prisma } from "@mediapulse/database";

/** Row shape for delivery run list (ticker symbol joined). */
export type DeliveryRunListRow = Prisma.DeliveryRunGetPayload<{
  include: { ticker: { select: { symbol: true } } };
}>;

export type ListItem = {
  id: string;
  createdAt: string;
  tickerSymbol: string;
  outcome: string;
  successCount: number;
  failureCount: number;
  skippedCount: number;
  durationMs: number;
  jobId: string | null;
  runSkipReason: string | null;
  recipientErrorSummary: string | null;
};

export type DetailItem = ListItem & {
  agentId: string;
  agentVersion: string;
  tickerId: string;
  newsletterId: string | null;
  stage: string | null;
  scheduleExecutionId: string | null;
  hermesScheduleId: string | null;
  pipelineStepId: string | null;
  jobId: string | null;
  hermesExecutionId: string | null;
  runSkipReason: string | null;
  resendMessageIds: string | null;
  recipientsJson: string;
};

/**
 * Maps a Prisma delivery run row to a table-v1 list item.
 *
 * @param row - Run with ticker relation.
 */
export function mapRowToListItem(row: DeliveryRunListRow): ListItem {
  return {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    tickerSymbol: row.ticker.symbol,
    outcome: row.outcome,
    successCount: row.successCount,
    failureCount: row.failureCount,
    skippedCount: row.skippedCount,
    durationMs: row.durationMs,
    jobId: row.jobId,
    runSkipReason: row.runSkipReason,
    recipientErrorSummary: row.recipientErrorSummary,
  };
}

export const listInclude = {
  ticker: { select: { symbol: true } },
} satisfies Prisma.DeliveryRunInclude;

export type DeliveryRunDetailRow = Prisma.DeliveryRunGetPayload<{
  include: {
    ticker: { select: { symbol: true } };
    recipients: true;
  };
}>;

/**
 * Maps a run with recipients to a Hermes detail payload (recipients as JSON text).
 *
 * @param row - Run with ticker and recipients.
 */
export function mapRowToDetailItem(row: DeliveryRunDetailRow): DetailItem {
  const base = mapRowToListItem(row);
  return {
    ...base,
    agentId: row.agentId,
    agentVersion: row.agentVersion,
    tickerId: row.tickerId,
    newsletterId: row.newsletterId,
    stage: row.stage,
    scheduleExecutionId: row.scheduleExecutionId,
    hermesScheduleId: row.hermesScheduleId,
    pipelineStepId: row.pipelineStepId,
    jobId: row.jobId,
    hermesExecutionId: row.hermesExecutionId,
    runSkipReason: row.runSkipReason,
    resendMessageIds:
      row.resendMessageIds === null || row.resendMessageIds === undefined
        ? null
        : typeof row.resendMessageIds === "string"
          ? row.resendMessageIds
          : JSON.stringify(row.resendMessageIds),
    recipientsJson: JSON.stringify(row.recipients, null, 2),
  };
}
