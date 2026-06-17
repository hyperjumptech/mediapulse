import type { DiscoveredItem, DiscoveryDeps } from "@workspace/agent-ingestion";
import { createListingDiscoveryStrategy } from "@workspace/agent-ingestion";

export type ExpandSourceUrlOptions = {
  maxItems?: number;
};

/**
 * Returns true when the URL likely points at a sitemap document.
 *
 * @param url - Candidate listing URL.
 */
export const looksLikeSitemapUrl = (url: string): boolean => {
  const lower = url.toLowerCase();
  return (
    lower.includes("sitemap") ||
    lower.endsWith(".xml") ||
    lower.endsWith(".xml.gz")
  );
};

/**
 * Returns true when the URL likely points at an RSS/Atom feed.
 *
 * @param url - Candidate listing URL.
 */
export const looksLikeFeedUrl = (url: string): boolean => {
  const lower = url.toLowerCase();
  return (
    lower.endsWith(".rss") ||
    lower.endsWith(".atom") ||
    lower.includes("/feed") ||
    lower.includes("/rss") ||
    lower.includes("format=xml")
  );
};

/**
 * Expands a curated source URL into candidate article URLs.
 * Sitemap and RSS feeds are parsed; all other URLs are treated as single articles.
 *
 * @param sourceUrl - Curated listing URL from run input.
 * @param deps - Shared discovery HTTP dependencies.
 * @param options - Optional per-source cap.
 */
export const expandSourceUrl = async (
  sourceUrl: string,
  deps: DiscoveryDeps,
  options: ExpandSourceUrlOptions = {},
): Promise<DiscoveredItem[]> => {
  const cap = (items: DiscoveredItem[]) =>
    options.maxItems !== undefined ? items.slice(0, options.maxItems) : items;

  if (looksLikeSitemapUrl(sourceUrl)) {
    try {
      const strategy = createListingDiscoveryStrategy("sitemap");
      const items = await strategy.discover(sourceUrl, deps);
      if (items.length > 0) {
        return cap(items);
      }
    } catch {
      // fall through to single-article mode
    }
  }

  if (looksLikeFeedUrl(sourceUrl)) {
    try {
      const strategy = createListingDiscoveryStrategy("rss");
      const items = await strategy.discover(sourceUrl, deps);
      if (items.length > 0) {
        return cap(items);
      }
    } catch {
      // fall through to single-article mode
    }
  }

  return [{ url: sourceUrl }];
};
