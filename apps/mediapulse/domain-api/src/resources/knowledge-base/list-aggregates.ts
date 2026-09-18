import type { PrismaClient } from "@mediapulse/database";

type MentionDelegate = Pick<PrismaClient["knowledgeEntityMention"], "findMany">;

/**
 * Counts the distinct articles behind each ticker's knowledge base.
 *
 * A mention row exists per entity per article, so counting rows would count one article once per
 * entity it names.
 *
 * @param tickerIds - Tickers to count for.
 * @param deps - Mention delegate.
 * @returns Article count per ticker id, zero for a ticker with none.
 */
export async function buildKnowledgeArticleCounts(
  tickerIds: readonly string[],
  deps: { knowledgeEntityMention: MentionDelegate },
): Promise<Map<string, number>> {
  const counts = new Map<string, number>(
    tickerIds.map((tickerId) => [tickerId, 0]),
  );
  if (tickerIds.length === 0) {
    return counts;
  }

  const rows = await deps.knowledgeEntityMention.findMany({
    where: { tickerId: { in: [...tickerIds] } },
    select: { tickerId: true, dataSourceId: true },
    distinct: ["tickerId", "dataSourceId"],
  });

  for (const row of rows) {
    counts.set(row.tickerId, (counts.get(row.tickerId) ?? 0) + 1);
  }

  return counts;
}
