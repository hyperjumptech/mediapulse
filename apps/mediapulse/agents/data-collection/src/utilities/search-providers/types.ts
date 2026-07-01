import type got from "got";

import type { ProviderName, SearchLocale } from "../config-schema";

/** Normalized search result returned by every search provider adapter. */
export interface SearchHit {
  url: string;
  title: string;
  snippet: string;
  publishedAt?: string;
}

/** A provider's response for one query: the hits plus optional provider-reported credits. */
export interface SearchProviderResult {
  hits: SearchHit[];
  /**
   * Provider-reported credits consumed by this response (Serper's `credits`).
   * Undefined for providers that do not report usage.
   */
  credits?: number;
}

/** Minimal structured logger passed into search provider adapters. */
export interface SearchProviderLogger {
  info: (obj: object, msg?: string) => void;
  warn: (obj: object, msg?: string) => void;
}

/** Shared per-request context for search provider adapters. */
export interface SearchProviderContext {
  gotClient: typeof got;
  /** Locale for this request. Serper uses gl/hl; Tavily/Exa ignore it. */
  locale: SearchLocale;
  /** Zero-based round index used to advance pagination on repeat rounds. */
  page: number;
  timeoutMs: number;
  logger: SearchProviderLogger;
}

/** Contract implemented by every web-search provider adapter. */
export interface SearchProvider {
  readonly type: ProviderName;
  search: (
    queryText: string,
    ctx: SearchProviderContext,
  ) => Promise<SearchProviderResult>;
}
