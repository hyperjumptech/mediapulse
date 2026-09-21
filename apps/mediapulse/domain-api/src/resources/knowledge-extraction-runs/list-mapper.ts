import type { Prisma } from "@mediapulse/database";

export const listInclude = {
  ticker: { select: { symbol: true, name: true } },
} satisfies Prisma.KnowledgeExtractionRunInclude;

export type KnowledgeExtractionRunRow =
  Prisma.KnowledgeExtractionRunGetPayload<{
    include: typeof listInclude;
  }>;

export type ListItem = {
  id: string;
  status: string;
  tickerSymbol: string;
  tickerName: string;
  tickerId: string | null;
  startedAt: string;
  completedAt: string | null;
  durationLabel: string;
  considered: number;
  entitiesCreated: number;
  mentionsWritten: number;
  relationsOpened: number;
  relationsConfirmed: number;
  kindsCreated: number;
  skippedNoCandidates: number;
  rejectedSpanNotInText: number;
  rejectedNameNotInText: number;
  /** Refused claims as a share of everything the model proposed. The headline quality number. */
  rejectionRate: string;
  agentVersion: string;
  watermarkAt: string | null;
  stopReason: string | null;
  scheduleExecutionId: string | null;
};

/**
 * Renders a duration for a reader.
 *
 * @param durationMs - Duration in milliseconds, or null for a run that never finished.
 */
export const formatDuration = (durationMs: number | null): string => {
  if (durationMs === null) {
    return "—";
  }
  if (durationMs < 1000) {
    return `${String(durationMs)} ms`;
  }
  const seconds = durationMs / 1000;
  if (seconds < 60) {
    return `${seconds.toFixed(1)} s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round(seconds % 60);

  return `${String(minutes)}m ${String(remainder)}s`;
};

/**
 * The share of proposed claims the guards refused.
 *
 * - Important: the denominator is everything the model proposed, which is what was written plus what
 *   was refused. A rate against articles read would fall as articles get quieter rather than as the
 *   model gets more honest.
 *
 * @param mentionsWritten - Mentions that survived the guards.
 * @param rejectedSpan - Claims whose evidence span was not in the article.
 * @param rejectedName - Claims naming a party the article never named.
 */
export const formatRejectionRate = (
  mentionsWritten: number,
  rejectedSpan: number,
  rejectedName: number,
): string => {
  const refused = rejectedSpan + rejectedName;
  const proposed = mentionsWritten + refused;
  if (proposed <= 0) {
    return "—";
  }

  return `${((refused / proposed) * 100).toFixed(1)}%`;
};

/**
 * Shapes one extraction run for the list.
 *
 * @param row - Run with its issuer.
 */
export function mapRowToListItem(row: KnowledgeExtractionRunRow): ListItem {
  return {
    id: row.id,
    status: row.status,
    // A run with no issuer is an unscoped sweep, which the schedule never produces but the contract
    // permits.
    tickerSymbol: row.ticker?.symbol ?? "—",
    tickerName: row.ticker?.name ?? "Every issuer",
    tickerId: row.tickerId,
    startedAt: row.startedAt.toISOString(),
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    durationLabel: formatDuration(row.durationMs),
    considered: row.considered,
    entitiesCreated: row.entitiesCreated,
    mentionsWritten: row.mentionsWritten,
    relationsOpened: row.relationsOpened,
    relationsConfirmed: row.relationsConfirmed,
    kindsCreated: row.kindsCreated,
    skippedNoCandidates: row.skippedNoCandidates,
    rejectedSpanNotInText: row.rejectedSpanNotInText,
    rejectedNameNotInText: row.rejectedNameNotInText,
    rejectionRate: formatRejectionRate(
      row.mentionsWritten,
      row.rejectedSpanNotInText,
      row.rejectedNameNotInText,
    ),
    agentVersion: row.agentVersion ?? "—",
    watermarkAt: row.watermarkAt ? row.watermarkAt.toISOString() : null,
    stopReason: row.stopReason,
    scheduleExecutionId: row.scheduleExecutionId,
  };
}
