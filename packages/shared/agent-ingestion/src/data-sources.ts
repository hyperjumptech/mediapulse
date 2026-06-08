import type { DataCollectionInput } from "@workspace/agent-types";

export interface CollectedPageForSource {
  url: string;
  title: string;
  content: string;
  tickerId: string;
  searchQueryId: string;
  searchQueryText?: string;
}

export interface DataCollectionSource extends DataCollectionInput {
  metadata: {
    provider?: string;
    searchQueryText?: string;
    fetchedAt: string;
    sourceType: "web";
  };
}

/**
 * Maps collected pages to data sources payload entries.
 *
 * @param tickerId - Ticker ID used for all emitted sources.
 * @param pages - Collected pages from the crawl/search steps.
 * @param now - Date factory for deterministic tests.
 * @returns Data sources with metadata for downstream processing.
 */
export function toDataSources(
  tickerId: string,
  pages: CollectedPageForSource[],
  now: () => Date = () => new Date(),
): DataCollectionSource[] {
  return pages.map((page) => ({
    url: page.url,
    title: page.title,
    content: page.content,
    tickerId,
    searchQueryId: page.searchQueryId,
    metadata: {
      searchQueryText: page.searchQueryText,
      fetchedAt: now().toISOString(),
      sourceType: "web",
    },
  }));
}
