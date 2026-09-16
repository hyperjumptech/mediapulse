import type { Prisma } from "@mediapulse/database";

export const listInclude = {
  _count: { select: { developments: true } },
} satisfies Prisma.KnowledgeIngestionRunInclude;

export type KnowledgeIngestionRunRow = Prisma.KnowledgeIngestionRunGetPayload<{
  include: typeof listInclude;
}>;

export type ListItem = {
  id: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  durationLabel: string;
  considered: number;
  storylinesOpened: number;
  developmentsOpened: number;
  citationsAdded: number;
  storylinesLocked: number;
  skippedNoAnchors: number;
  attachRate: string;
  agentVersion: string;
  watermarkAt: string | null;
  stopReason: string | null;
  scheduleExecutionId: string | null;
  developmentsWritten: number;
};

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

export const formatAttachRate = (
  considered: number,
  citationsAdded: number,
): string => {
  if (considered <= 0) {
    return "—";
  }
  const percent = (citationsAdded / considered) * 100;

  return `${percent.toFixed(1)}%`;
};

export function mapRowToListItem(row: KnowledgeIngestionRunRow): ListItem {
  return {
    id: row.id,
    status: row.status,
    startedAt: row.startedAt.toISOString(),
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    durationLabel: formatDuration(row.durationMs),
    considered: row.considered,
    storylinesOpened: row.storylinesOpened,
    developmentsOpened: row.developmentsOpened,
    citationsAdded: row.citationsAdded,
    storylinesLocked: row.storylinesLocked,
    skippedNoAnchors: row.skippedNoAnchors,
    attachRate: formatAttachRate(row.considered, row.citationsAdded),
    agentVersion: row.agentVersion ?? "—",
    watermarkAt: row.watermarkAt ? row.watermarkAt.toISOString() : null,
    stopReason: row.stopReason,
    scheduleExecutionId: row.scheduleExecutionId,
    developmentsWritten: row._count.developments,
  };
}
