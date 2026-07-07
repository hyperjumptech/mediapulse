import { createDiffbotFetchProvider } from "./diffbot";
import { createExaFetchProvider } from "./exa";
import { createFirecrawlFetchProvider } from "./firecrawl";
import { createJinaFetchProvider } from "./jina";
import { createSerperFetchProvider } from "./serper";
import { createTavilyFetchProvider } from "./tavily";

import type { FetchProvider, FetchProviderConfig } from "./types";

export type { FetchProviderConfig } from "./types";

/**
 * Instantiates a fetch provider adapter from runtime configuration.
 *
 * @param config - Provider configuration including the `type` discriminator.
 */
export const createFetchProvider = (
  config: FetchProviderConfig,
): FetchProvider => {
  switch (config.type) {
    case "serper":
      return createSerperFetchProvider(config);
    case "jina":
      return createJinaFetchProvider(config);
    case "firecrawl":
    case "firecrawl_selfhosted":
      return createFirecrawlFetchProvider(config);
    case "diffbot":
      return createDiffbotFetchProvider(config);
    case "tavily":
      return createTavilyFetchProvider(config);
    case "exa":
      return createExaFetchProvider(config);
    default:
      throw new Error(`Unknown fetch provider type: ${config.type}`);
  }
};

/**
 * Builds an ordered provider chain from configuration entries.
 *
 * @param configs - Ordered provider configs; index 0 is the primary provider.
 */
export const createFetchProviderChain = (
  configs: FetchProviderConfig[],
): FetchProvider[] => configs.map(createFetchProvider);
