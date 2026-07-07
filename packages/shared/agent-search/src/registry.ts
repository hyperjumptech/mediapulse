import type { ProviderEntry } from "./schemas";
import { createExaSearchProvider } from "./exa";
import {
  createFirecrawlSearchProvider,
  createFirecrawlSelfhostedSearchProvider,
} from "./firecrawl";
import { createSerperSearchProvider } from "./serper";
import { createTavilySearchProvider } from "./tavily";

import type { SearchProvider } from "./types";

/**
 * Returns the entry's API key, throwing when a provider that requires one is
 * missing it. `providerEntrySchema` enforces this at parse time; the guard keeps
 * the registry sound for callers that construct entries directly.
 *
 * @param entry - Provider entry from config.
 */
const requireApiKey = (entry: ProviderEntry): string => {
  if (!entry.apiKey) {
    throw new Error(`Missing API key for search provider: ${entry.provider}`);
  }
  return entry.apiKey;
};

/**
 * Instantiates a search provider adapter from a config entry.
 *
 * @param entry - Provider name plus credentials (API key, or base URL and headers).
 */
export const createSearchProvider = (entry: ProviderEntry): SearchProvider => {
  switch (entry.provider) {
    case "serper":
      return createSerperSearchProvider(requireApiKey(entry));
    case "tavily":
      return createTavilySearchProvider(requireApiKey(entry));
    case "exa":
      return createExaSearchProvider(requireApiKey(entry));
    case "firecrawl":
      return createFirecrawlSearchProvider({
        apiKey: requireApiKey(entry),
        ...(entry.baseUrl ? { baseUrl: entry.baseUrl } : {}),
      });
    case "firecrawl_selfhosted":
      if (!entry.baseUrl) {
        throw new Error(
          "Missing base URL for search provider: firecrawl_selfhosted",
        );
      }
      return createFirecrawlSelfhostedSearchProvider({
        baseUrl: entry.baseUrl,
        ...(entry.headers ? { headers: entry.headers } : {}),
      });
    default:
      throw new Error(`Unknown search provider: ${entry.provider}`);
  }
};

export type { SearchHit, SearchProvider } from "./types";
