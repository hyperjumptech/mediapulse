import type { Prisma } from "@mediapulse/database";

import { mapRowToListItem, type ListItem } from "./list-mapper";

export const KNOWLEDGE_INGESTION_RUN_DEVELOPMENT_CAP = 200;

export const detailInclude = {
  _count: { select: { developments: true } },
  developments: {
    orderBy: { observedAt: "asc" },
    take: KNOWLEDGE_INGESTION_RUN_DEVELOPMENT_CAP,
    select: {
      id: true,
      title: true,
      observedAt: true,
      storylineId: true,
      storyline: { select: { name: true, kind: true, locked: true } },
      _count: { select: { citations: true } },
    },
  },
} satisfies Prisma.KnowledgeIngestionRunInclude;

export type KnowledgeIngestionRunDetailRow =
  Prisma.KnowledgeIngestionRunGetPayload<{ include: typeof detailInclude }>;

export type RunDevelopmentRow = {
  id: string;
  title: string;
  observedAt: string;
  storylineId: string;
  storylineName: string;
  citationCount: number;
};

export type DetailItem = ListItem & {
  developments: RunDevelopmentRow[];
};

export function mapRowToDetailItem(
  row: KnowledgeIngestionRunDetailRow,
): DetailItem {
  const base = mapRowToListItem(row);

  return {
    ...base,
    developments: row.developments.map((development) => ({
      id: development.id,
      title: development.title,
      observedAt: development.observedAt.toISOString(),
      storylineId: development.storylineId,
      storylineName: development.storyline.name,
      citationCount: development._count.citations,
    })),
  };
}
