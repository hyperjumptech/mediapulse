import type got from "got";
import type { HostErrorTracker } from "../host-error-tracker";
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
  /** When provided, hosts over the error threshold are skipped in discovery. */
  hostErrorTracker?: HostErrorTracker;
  /** Per-strategy HTTP timeout in milliseconds. Passed to the underlying got request. */
  timeoutMs?: number;
  /** Maximum concurrent discovery sources processed by runDiscovery. Defaults to 4. */
  concurrency?: number;
};

/** Contract implemented by every listing discovery strategy. */
export type ListingDiscoveryStrategy = {
  readonly type: "rss" | "sitemap" | "generic-links";
  discover: (
    listingUrl: string,
    deps: DiscoveryDeps,
  ) => Promise<DiscoveredItem[]>;
};
