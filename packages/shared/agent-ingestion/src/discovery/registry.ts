import { genericLinksStrategy } from "./generic-links";
import { rssStrategy } from "./rss";
import { sitemapStrategy } from "./sitemap";
import type { ListingDiscoveryStrategy } from "./types";

/** Ordered default discovery chain tried for every source unless overridden. */
export const DEFAULT_DISCOVERY_CHAIN: ReadonlyArray<
  "rss" | "sitemap" | "generic-links"
> = ["rss", "sitemap", "generic-links"];

/**
 * Returns the listing discovery strategy for the given type.
 *
 * @param type - Strategy type key.
 * @throws When `type` is not a known discovery strategy.
 */
export const createListingDiscoveryStrategy = (
  type: "rss" | "sitemap" | "generic-links",
): ListingDiscoveryStrategy => {
  switch (type) {
    case "rss":
      return rssStrategy;
    case "sitemap":
      return sitemapStrategy;
    case "generic-links":
      return genericLinksStrategy;
    default:
      throw new Error(`Unknown listing discovery strategy type: ${type}`);
  }
};
