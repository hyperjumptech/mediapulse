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
 * Instantiates a search provider adapter from a config entry.
 *
 * @param entry - Provider name plus credentials (API key, or base URL and headers).
 */
export const createSearchProvider = (entry: ProviderEntry): SearchProvider => {
  switch (entry.provider) {
    case "serper":
      return createSerperSearchProvider(entry.apiKey);
    case "tavily":
      return createTavilySearchProvider(entry.apiKey);
    case "exa":
      return createExaSearchProvider(entry.apiKey);
    case "firecrawl":
      return createFirecrawlSearchProvider({ apiKey: entry.apiKey });
    case "firecrawl_selfhosted":
      return createFirecrawlSelfhostedSearchProvider({
        baseUrl: entry.baseUrl,
        ...(entry.headers ? { headers: entry.headers } : {}),
      });
    default: {
      const exhaustiveCheck: never = entry;

      throw new Error(
        `Unknown search provider: ${JSON.stringify(exhaustiveCheck)}`,
      );
    }
  }
};

export type { SearchHit, SearchProvider } from "./types";
