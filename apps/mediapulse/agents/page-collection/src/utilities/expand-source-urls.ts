import type { DiscoveredItem, DiscoveryDeps } from "@workspace/agent-ingestion";
import { createListingDiscoveryStrategy } from "@workspace/agent-ingestion";

export type CuratedSourceLinkType = "page" | "listing";

export type ExpandSourceUrlOptions = {
  maxItems?: number;
  linkType?: CuratedSourceLinkType;
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
 * Attempts sitemap or RSS discovery when URL heuristics match.
 *
 * @param sourceUrl - Curated listing URL.
 * @param deps - Shared discovery HTTP dependencies.
 * @returns Discovered items, or `null` when no feed/sitemap strategy applies.
 */
const discoverSitemapOrFeed = async (
  sourceUrl: string,
  deps: DiscoveryDeps,
): Promise<DiscoveredItem[] | null> => {
  if (looksLikeSitemapUrl(sourceUrl)) {
    try {
      const strategy = createListingDiscoveryStrategy("sitemap");
      const items = await strategy.discover(sourceUrl, deps);
      if (items.length > 0) {
        return items;
      }
    } catch {
      // fall through to RSS or generic listing handling
    }
  }

  if (looksLikeFeedUrl(sourceUrl)) {
    try {
      const strategy = createListingDiscoveryStrategy("rss");
      const items = await strategy.discover(sourceUrl, deps);
      if (items.length > 0) {
        return items;
      }
    } catch {
      // fall through to generic listing handling
    }
  }

  return null;
};

/**
 * Expands a curated source URL into candidate article URLs.
 * Page sources return a single URL; listing sources use feed/sitemap heuristics
 * and HTML link extraction.
 *
 * @param sourceUrl - Curated listing URL from run input.
 * @param deps - Shared discovery HTTP dependencies.
 * @param options - Optional per-source cap and stored link type.
 */
export const expandSourceUrl = async (
  sourceUrl: string,
  deps: DiscoveryDeps,
  options: ExpandSourceUrlOptions = {},
): Promise<DiscoveredItem[]> => {
  const cap = (items: DiscoveredItem[]) =>
    options.maxItems !== undefined ? items.slice(0, options.maxItems) : items;

  if (options.linkType === "page") {
    return cap([{ url: sourceUrl }]);
  }

  const feedOrSitemapItems = await discoverSitemapOrFeed(sourceUrl, deps);
  if (feedOrSitemapItems) {
    return cap(feedOrSitemapItems);
  }

  if (options.linkType === "listing") {
    try {
      const strategy = createListingDiscoveryStrategy("generic-links");
      const items = await strategy.discover(sourceUrl, deps);
      if (items.length > 0) {
        return cap(items);
      }
    } catch {
      // fall through to single-article mode
    }
  }

  return cap([{ url: sourceUrl }]);
};
