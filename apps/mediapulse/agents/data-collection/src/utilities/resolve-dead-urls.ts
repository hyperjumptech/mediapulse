import {
  DATA_COLLECTION_DEAD_URLS_LOOKUP_MAX,
  type PostDataCollectionDeadUrlsLookupBody,
  type PostDataCollectionDeadUrlsLookupResponse,
} from "@workspace/agent-data-api-contract";

/** Typed Agent Data API POST for dead URL lookup (SDK `dataCollectionDeadUrlsLookup.create`). */
export type LookupDeadUrls = (
  body: PostDataCollectionDeadUrlsLookupBody,
) => Promise<PostDataCollectionDeadUrlsLookupResponse>;

/**
 * Resolves which candidate URLs are cached as dead for the ticker, batching requests
 * to respect the configured batch size (capped by {@link DATA_COLLECTION_DEAD_URLS_LOOKUP_MAX}).
 *
 * @param tickerId - Ticker id passed to the lookup API.
 * @param candidateUrls - URLs from web search (may contain duplicates).
 * @param lookupDeadUrls - Injected lookup (production: SDK `create`).
 * @param batchSize - Max URLs per lookup request.
 * @returns Set of URLs to skip because they are in the negative cache.
 */
export async function resolveDeadUrls(
  tickerId: string,
  candidateUrls: readonly string[],
  lookupDeadUrls: LookupDeadUrls,
  batchSize: number = DATA_COLLECTION_DEAD_URLS_LOOKUP_MAX,
): Promise<Set<string>> {
  const unique = [...new Set(candidateUrls)];
  const dead = new Set<string>();
  const effectiveBatchSize = Math.min(
    batchSize,
    DATA_COLLECTION_DEAD_URLS_LOOKUP_MAX,
  );

  if (unique.length === 0) {
    return dead;
  }

  for (let index = 0; index < unique.length; index += effectiveBatchSize) {
    const chunk = unique.slice(index, index + effectiveBatchSize);
    const response = await lookupDeadUrls({
      tickerId,
      urls: chunk,
    });
    for (const url of response.deadUrls) {
      dead.add(url);
    }
  }

  return dead;
}
