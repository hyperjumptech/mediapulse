import type {
  PostQueryAnalysisBody,
  PostQueryAnalysisResponse,
} from "@workspace/agent-data-api-contract";
import type { Prisma, PrismaClient } from "@mediapulse/database";

/**
 * Normalizes query text for deduplication within a batch.
 *
 * @param text - Raw query string.
 * @returns Collapsed lowercase key.
 */
export const normalizeQueryTextKey = (text: string): string =>
  text.trim().replace(/\s+/g, " ").toLowerCase();

type QueryItem = PostQueryAnalysisBody["queries"][number];

/**
 * Dedupes query candidates by normalized text, keeping the first occurrence order.
 *
 * @param queries - Candidate rows from the agent.
 * @returns Deduplicated list.
 */
export const dedupeQueryItems = (queries: QueryItem[]): QueryItem[] => {
  const seen = new Set<string>();
  const out: QueryItem[] = [];
  for (const q of queries) {
    const key = normalizeQueryTextKey(q.text);
    if (key.length === 0 || seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(q);
  }
  return out;
};

/**
 * Persists a new `SearchQuerySet` and child `SearchQuery` rows in one transaction; optionally activates the set (FR2, FR6).
 *
 * @param prisma - Mediapulse Prisma client.
 * @param body - Validated POST body from the contract.
 * @returns Counts and set ids for the response envelope.
 */
export const persistQueryAnalysisSet = async (
  prisma: PrismaClient,
  body: PostQueryAnalysisBody,
): Promise<PostQueryAnalysisResponse> => {
  const ticker = await prisma.ticker.findUnique({
    where: { id: body.tickerId },
    select: { id: true },
  });
  if (!ticker) {
    throw new Error("TICKER_NOT_FOUND");
  }

  const uniqueQueries = dedupeQueryItems(body.queries);
  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    let activeSetId: string;

    if (body.activate) {
      await tx.searchQuerySet.updateMany({
        where: { tickerId: body.tickerId, isActive: true },
        data: { isActive: false },
      });
    }

    const setRow = await tx.searchQuerySet.create({
      data: {
        tickerId: body.tickerId,
        generatedAt: now,
        isActive: body.activate,
        strategySnapshot: body.strategySnapshot as Prisma.InputJsonValue,
        generationSource: body.generationSource,
        agentJobId: body.agentJobId ?? null,
      },
    });

    if (body.activate) {
      activeSetId = setRow.id;
    } else {
      const current = await tx.searchQuerySet.findFirst({
        where: { tickerId: body.tickerId, isActive: true },
        select: { id: true },
      });
      activeSetId = current?.id ?? setRow.id;
    }

    if (uniqueQueries.length > 0) {
      await tx.searchQuery.createMany({
        data: uniqueQueries.map((q) => ({
          text: q.text.trim(),
          tickerId: body.tickerId,
          setId: setRow.id,
          source: q.source,
          intent: q.intent,
          rank: q.rank,
        })),
      });
    }

    return {
      created: uniqueQueries.length,
      setId: setRow.id,
      activeSetId,
    };
  });

  return result;
};
