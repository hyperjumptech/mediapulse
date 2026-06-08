import type got from "got";
import type { RateLimiter } from "../resilience";

/** One article item yielded by a listing discovery strategy. */
export type DiscoveredItem = {
  url: string;
  title?: string;
  summary?: string;
  publishedAt?: string;
};

/** Minimal structured logger passed to discovery strategies. */
export type DiscoveryLogger = {
  info: (obj: object, msg?: string) => void;
  warn: (obj: object, msg?: string) => void;
};

/** Shared dependencies for listing discovery strategies. */
export type DiscoveryDeps = {
  gotClient: typeof got;
  rateLimiter: RateLimiter;
  logger: DiscoveryLogger;
};

/** Contract implemented by every listing discovery strategy. */
export type ListingDiscoveryStrategy = {
  readonly type: "rss" | "sitemap" | "generic-links";
  discover: (
    listingUrl: string,
    deps: DiscoveryDeps,
  ) => Promise<DiscoveredItem[]>;
};
