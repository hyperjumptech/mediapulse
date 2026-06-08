import type { DiscoveredItem } from "@workspace/agent-ingestion";

export type AliasContext = {
  tickerAliases: string[];
  industryAliases: string[];
};

/**
 * Pre-filters discovered items by ticker and industry aliases before fetch.
 *
 * Items with a title or summary are kept only when the lowercased title+summary
 * text contains at least one alias. Items without a title pass through unchanged
 * (e.g. generic-links items).
 *
 * @param items - Discovered items from the listing discovery stage.
 * @param aliasContext - Ticker and industry aliases for the relevance check.
 */
export function prefilterByAliases(
  items: DiscoveredItem[],
  aliasContext: AliasContext,
): DiscoveredItem[] {
  const { tickerAliases, industryAliases } = aliasContext;
  const allAliases = [...tickerAliases, ...industryAliases].map((alias) =>
    alias.toLowerCase(),
  );

  if (allAliases.length === 0) {
    return items;
  }

  return items.filter((item) => {
    if (!item.title) {
      return true;
    }

    const text = [item.title, item.summary ?? ""].join(" ").toLowerCase();

    return allAliases.some((alias) => text.includes(alias));
  });
}
