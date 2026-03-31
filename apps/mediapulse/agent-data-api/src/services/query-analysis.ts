import { prisma } from "@mediapulse/database";

export async function getQueryAnalysisContext(tickerId: string) {
  const ticker = await prisma.ticker.findUniqueOrThrow({
    where: { id: tickerId },
    select: { id: true, symbol: true, name: true, metadata: true },
  });

  const tickerEntities = await prisma.tickerEntity.findMany({
    where: { tickerId },
    orderBy: { relevanceWeight: "desc" },
    take: 20,
    include: {
      entity: {
        include: {
          type: true,
        },
      },
    },
  });

  const topEntities = tickerEntities.map((te) => ({
    canonicalName: te.entity.canonicalName,
    typeName: te.entity.type.name,
    relevanceWeight: te.relevanceWeight,
  }));

  // Recent themes would be aggregated here. Returning an empty array for now
  // as Phase 2 will implement full theme enrichment.
  const recentThemes: { theme: string; articleCount: number }[] = [];

  const configSnapshot = {
    queryCount: Number(process.env.QUERY_ANALYSIS_QUERY_COUNT || 10),
    allowedLanguages: JSON.parse(
      process.env.QUERY_ANALYSIS_ALLOWED_LANGUAGES || '["en"]',
    ),
    minDeterministicCount: Number(
      process.env.QUERY_ANALYSIS_MIN_DETERMINISTIC_COUNT || 3,
    ),
    weightBreaking: Number(process.env.QUERY_ANALYSIS_WEIGHT_BREAKING || 0.5),
    weightKgChange: Number(process.env.QUERY_ANALYSIS_WEIGHT_KG_CHANGE || 0.3),
    weightFundamental: Number(
      process.env.QUERY_ANALYSIS_WEIGHT_FUNDAMENTAL || 0.2,
    ),
    model: process.env.QUERY_ANALYSIS_MODEL || "gpt-4o",
    maxTokens: Number(process.env.QUERY_ANALYSIS_MAX_TOKENS || 1000),
  };

  return {
    ticker,
    topEntities,
    recentThemes,
    configSnapshot,
  };
}

export async function createQueryAnalysisSet(data: {
  tickerId: string;
  queries: {
    text: string;
    source: "deterministic" | "llm" | string;
    intent: "breaking" | "kg_change" | "fundamental" | string;
    rank: number;
  }[];
  strategySnapshot: any;
  agentJobId?: string | null;
  activate: boolean;
  generationSource: string;
}) {
  return await prisma.$transaction(async (tx) => {
    if (data.activate) {
      await tx.searchQuerySet.updateMany({
        where: { tickerId: data.tickerId, isActive: true },
        data: { isActive: false },
      });
    }

    const querySet = await tx.searchQuerySet.create({
      data: {
        tickerId: data.tickerId,
        generatedAt: new Date(),
        isActive: data.activate,
        strategySnapshot: data.strategySnapshot,
        generationSource: data.generationSource,
        agentJobId: data.agentJobId,
        searchQueries: {
          create: data.queries.map((q) => ({
            text: q.text,
            source: q.source,
            intent: q.intent,
            rank: q.rank,
            tickerId: data.tickerId,
          })),
        },
      },
      include: {
        searchQueries: true,
      },
    });

    let activeSetId = querySet.id;
    if (!data.activate) {
      const activeSet = await tx.searchQuerySet.findFirst({
        where: { tickerId: data.tickerId, isActive: true },
        select: { id: true },
      });
      if (activeSet) {
        activeSetId = activeSet.id;
      }
    }

    return {
      created: querySet.searchQueries.length,
      createdSetId: querySet.id,
      activeSetId,
    };
  });
}
