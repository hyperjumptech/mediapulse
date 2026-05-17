import type { Prisma, prisma } from "@mediapulse/database";

/** Shape of one active-query-set entry exposed by the detail handler. */
export type ActiveQuerySetPayload = {
  setId: string;
  generatedAt: string;
  generationSource: string;
  queries: Array<{
    id: string;
    text: string;
    source: string;
    intent: string;
    rank: number;
  }>;
} | null;

/** Prisma collaborator surface for {@link findActiveQuerySetForNewsletter}. */
type SearchQuerySetDelegate = Pick<typeof prisma.searchQuerySet, "findFirst">;

/**
 * Finds the most recent active SearchQuerySet for a ticker generated on or
 * before the newsletter's `createdAt`. Returns `null` when no matching set
 * exists.
 *
 * @param tickerId - Ticker the newsletter belongs to.
 * @param createdAt - Newsletter's `createdAt` (acts as upper bound for `generatedAt`).
 * @param deps - Prisma `searchQuerySet` delegate (defaults to the global client when wired by the route).
 * @returns Active set with its queries, or `null`.
 */
export const findActiveQuerySetForNewsletter = async (
  tickerId: string,
  createdAt: Date,
  deps: { searchQuerySet: SearchQuerySetDelegate },
): Promise<ActiveQuerySetPayload> => {
  const findFirstArgs = {
    where: {
      tickerId,
      isActive: true,
      generatedAt: { lte: createdAt },
    },
    include: {
      searchQueries: {
        orderBy: [{ rank: "asc" as const }, { createdAt: "asc" as const }],
      },
    },
    orderBy: { generatedAt: "desc" as const },
  } satisfies Prisma.SearchQuerySetFindFirstArgs;

  const set = await deps.searchQuerySet.findFirst(findFirstArgs);
  if (!set) {
    return null;
  }

  return {
    setId: set.id,
    generatedAt: set.generatedAt.toISOString(),
    generationSource: set.generationSource,
    queries: set.searchQueries.map((query) => ({
      id: query.id,
      text: query.text,
      source: query.source,
      intent: query.intent,
      rank: query.rank,
    })),
  };
};
