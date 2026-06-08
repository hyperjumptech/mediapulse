import {
  DATA_COLLECTION_EXISTING_URLS_MAX,
  type PostDataCollectionExistingUrlsBody,
  type PostDataCollectionExistingUrlsResponse,
} from "@workspace/agent-data-api-contract";

/** Typed Agent Data API POST for existing URL lookup (SDK `dataCollectionExistingUrls.create`). */
export type LookupExistingDataSourceUrls = (
  body: PostDataCollectionExistingUrlsBody,
) => Promise<PostDataCollectionExistingUrlsResponse>;

export type ExistingDataSourceLookupResult = {
  existingUrls: Set<string>;
  hostCounts: Record<string, number>;
};

/**
 * Resolves which candidate URLs already have a `data_source` row for the ticker, batching requests
 * to respect {@link DATA_COLLECTION_EXISTING_URLS_MAX}.
 *
 * @param tickerId - Ticker id passed to the lookup API.
 * @param candidateUrls - URLs from web search (may contain duplicates).
 * @param lookupExistingUrls - Injected lookup (production: SDK `create`).
 * @returns Existing URL set and host counts for ranking.
 */
export async function resolveExistingDataSourceUrls(
  tickerId: string,
  candidateUrls: readonly string[],
  lookupExistingUrls: LookupExistingDataSourceUrls,
): Promise<ExistingDataSourceLookupResult> {
  const unique = [...new Set(candidateUrls)];
  const existing = new Set<string>();
  let hostCounts: Record<string, number> = {};

  if (unique.length === 0) {
    const response = await lookupExistingUrls({ tickerId, urls: [] });
    return {
      existingUrls: existing,
      hostCounts: response.hostCounts,
    };
  }

  for (
    let index = 0;
    index < unique.length;
    index += DATA_COLLECTION_EXISTING_URLS_MAX
  ) {
    const chunk = unique.slice(
      index,
      index + DATA_COLLECTION_EXISTING_URLS_MAX,
    );
    const response = await lookupExistingUrls({
      tickerId,
      urls: chunk,
    });
    if (Object.keys(hostCounts).length === 0) {
      hostCounts = response.hostCounts;
    }
    for (const url of response.existingUrls) {
      existing.add(url);
    }
  }

  return { existingUrls: existing, hostCounts };
}
