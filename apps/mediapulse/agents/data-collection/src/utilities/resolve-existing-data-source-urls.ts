import {
  DATA_COLLECTION_EXISTING_URLS_MAX,
  type PostDataCollectionExistingUrlsBody,
  type PostDataCollectionExistingUrlsResponse,
} from "@workspace/agent-data-api-contract";

/** Typed Agent Data API POST for existing URL lookup (SDK `dataCollectionExistingUrls.create`). */
export type LookupExistingDataSourceUrls = (
  body: PostDataCollectionExistingUrlsBody,
) => Promise<PostDataCollectionExistingUrlsResponse>;

/**
 * Resolves which candidate URLs already have a `data_source` row for the ticker, batching requests
 * to respect {@link DATA_COLLECTION_EXISTING_URLS_MAX}.
 *
 * @param tickerId - Ticker id passed to the lookup API.
 * @param candidateUrls - URLs from web search (may contain duplicates).
 * @param lookupExistingUrls - Injected lookup (production: SDK `create`).
 * @returns Set of URLs that already exist (exact string match).
 */
export async function resolveExistingDataSourceUrls(
  tickerId: string,
  candidateUrls: readonly string[],
  lookupExistingUrls: LookupExistingDataSourceUrls,
): Promise<Set<string>> {
  const unique = [...new Set(candidateUrls)];
  const existing = new Set<string>();

  for (let i = 0; i < unique.length; i += DATA_COLLECTION_EXISTING_URLS_MAX) {
    const chunk = unique.slice(i, i + DATA_COLLECTION_EXISTING_URLS_MAX);
    const { existingUrls } = await lookupExistingUrls({
      tickerId,
      urls: chunk,
    });
    for (const url of existingUrls) {
      existing.add(url);
    }
  }

  return existing;
}
