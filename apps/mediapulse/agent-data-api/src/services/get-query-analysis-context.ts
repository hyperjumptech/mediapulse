import type { GetQueryAnalysisResponse } from "@workspace/agent-data-api-contract";
import type { PrismaClient } from "@mediapulse/database";
import { Prisma } from "@mediapulse/database";

import { buildQueryAnalysisConfigSnapshot } from "./build-query-analysis-config-snapshot.js";
import type { MediapulseEnvLike } from "./query-analysis-env-types.js";

const topEntitiesArgs = {
  where: { tickerId: "" as string },
  orderBy: { relevanceWeight: "desc" as const },
  take: 15,
  include: {
    entity: {
      include: {
        type: { select: { name: true } },
      },
    },
  },
} satisfies Prisma.TickerEntityFindManyArgs;

/**
 * Loads ticker-scoped context for query generation: ticker row, top ticker entities, lightweight themes from recent articles, and global config snapshot.
 *
 * @param prisma - Mediapulse Prisma client.
 * @param tickerId - Target ticker id.
 * @param envLike - Env subset for {@link buildQueryAnalysisConfigSnapshot}.
 * @returns Contract-shaped GET response or `null` when the ticker does not exist.
 */
export const getQueryAnalysisContext = async (
  prisma: PrismaClient,
  tickerId: string,
  envLike: MediapulseEnvLike,
): Promise<GetQueryAnalysisResponse | null> => {
  const ticker = await prisma.ticker.findUnique({
    where: { id: tickerId },
  });
  if (!ticker) {
    return null;
  }

  const entityArgs = {
    ...topEntitiesArgs,
    where: { tickerId },
  } satisfies Prisma.TickerEntityFindManyArgs;

  const tickerEntities = await prisma.tickerEntity.findMany(entityArgs);

  const recentSources = await prisma.dataSource.findMany({
    where: { tickerId },
    select: { title: true },
    orderBy: { createdAt: "desc" },
    take: 80,
  });

  const themeCounts = new Map<string, number>();
  for (const row of recentSources) {
    const key = row.title.trim().slice(0, 48).toLowerCase() || "(untitled)";
    themeCounts.set(key, (themeCounts.get(key) ?? 0) + 1);
  }
  const recentThemes = [...themeCounts.entries()]
    .map(([theme, articleCount]) => ({ theme, articleCount }))
    .sort((a, b) => b.articleCount - a.articleCount)
    .slice(0, 12);

  return {
    ticker: {
      id: ticker.id,
      symbol: ticker.symbol,
      name: ticker.name,
      metadata: ticker.metadata ?? null,
    },
    topEntities: tickerEntities.map((te) => ({
      canonicalName: te.entity.canonicalName,
      typeName: te.entity.type.name,
      relevanceWeight: te.relevanceWeight,
    })),
    recentThemes,
    configSnapshot: buildQueryAnalysisConfigSnapshot(envLike),
    relationDeltas: [],
  };
};
