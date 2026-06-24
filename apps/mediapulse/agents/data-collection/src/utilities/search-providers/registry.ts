import type { ProviderEntry } from "../config-schema";
import { createExaSearchProvider } from "./exa";
import { createSerperSearchProvider } from "./serper";
import { createTavilySearchProvider } from "./tavily";

import type { SearchProvider } from "./types";

/**
 * Instantiates a search provider adapter from a config entry.
 *
 * @param entry - Provider name and API key.
 */
export const createSearchProvider = (entry: ProviderEntry): SearchProvider => {
  switch (entry.provider) {
    case "serper":
      return createSerperSearchProvider(entry.apiKey);
    case "tavily":
      return createTavilySearchProvider(entry.apiKey);
    case "exa":
      return createExaSearchProvider(entry.apiKey);
    default:
      throw new Error(`Unknown search provider: ${entry.provider}`);
  }
};

export type { SearchHit, SearchProvider } from "./types";
