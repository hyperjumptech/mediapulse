import type { Prisma } from "@mediapulse/database";

/** Reserved query text for all curated-listing synthetic queries. */
export const CURATED_LISTING_TEXT = "[curated-listing]";

type SearchQueryDb = Pick<
  typeof import("@mediapulse/database").prisma.searchQuery,
  "findFirst" | "create"
>;

/**
 * Returns the id of the stable per-ticker curated SearchQuery, creating it on first call.
 *
 * @param tickerId - Ticker the curated query belongs to.
 * @param searchQuery - Prisma delegate for `searchQuery`.
 */
export async function ensureCuratedListingQuery(
  tickerId: string,
  searchQuery: SearchQueryDb,
): Promise<string> {
  const findArgs = {
    where: { tickerId, text: CURATED_LISTING_TEXT },
    select: { id: true },
  } satisfies Prisma.SearchQueryFindFirstArgs;

  const existing = await searchQuery.findFirst(findArgs);
  if (existing) {
    return existing.id;
  }

  const createArgs = {
    data: {
      tickerId,
      text: CURATED_LISTING_TEXT,
      setId: null,
    },
    select: { id: true },
  } satisfies Prisma.SearchQueryCreateArgs;

  const created = await searchQuery.create(createArgs);

  return created.id;
}
