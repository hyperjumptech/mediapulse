import type { DataCollectionInput } from "@workspace/agent-types";
import { createAgentDataApiClient } from "@workspace/agent-data-api-client";
import { createAgentApp } from "@workspace/agent-runtime";
import { env } from "@mediapulse/env/agents-data-collection";

import { z } from "zod";
import { ConfigSchema } from "./utilities/config-schema.js";
import { performWebFetch } from "./utilities/web-fetch.js";
import {
  performWebSearch,
  type SearchQuery,
  type WebSearchResult,
} from "./utilities/web-search.js";

const BodySchema = z.object({
  tickerId: z.string(),
  timeWindow: z
    .object({
      start: z.string().datetime(),
      end: z.string().datetime(),
    })
    .optional(),
});

type Input = z.infer<typeof BodySchema>;
type Config = z.infer<typeof ConfigSchema>;

/** Internal shape for a collected page before sending to the API (includes searchQueryText for metadata). */
interface CollectedPage {
  url: string;
  title: string;
  content: string;
  tickerId: string;
  searchQueryId: string;
  searchQueryText: string;
}

const app = createAgentApp<
  Input,
  typeof BodySchema,
  Config,
  typeof ConfigSchema
>(
  {
    agentId: "data-collection",
    agentVersion: "1.0.0",
    inputSchema: BodySchema,
    configSchema: ConfigSchema,
    run: async ({ input, config: _config, token }) => {
      if (!env.JINA_API_KEY) {
        throw new Error("JINA_API_KEY is not configured");
      }
      if (!env.SERPER_API_KEY) {
        throw new Error("SERPER_API_KEY is not configured");
      }

      const dataApiClient = createAgentDataApiClient({
        baseUrl: env.AGENT_DATA_API_URL,
        version: "v1",
        token,
      });
      const query: { tickerId: string; start?: string; end?: string } = {
        tickerId: input.tickerId,
      };
      if (input.timeWindow) {
        query.start = input.timeWindow.start;
        query.end = input.timeWindow.end;
      }
      const { data: queries = [] } =
        await dataApiClient.dataCollection.get(query);
      const searchResults = await performWebSearchWithQueries(queries);
      const pages = await fetchWebPageContents(searchResults);

      if (pages.length > 0) {
        const sources = toDataCollectionInputs(input.tickerId, pages);
        await dataApiClient.dataCollection.create(sources);
      }

      return { success: true };
    },
  },
  {
    authApiUrl: env.AGENT_AUTH_API_URL,
    autoRegister:
      env.AGENT_REGISTRY_URL &&
      env.DOMAIN_INTEGRATION_API_KEY &&
      env.AGENT_PUBLIC_URL
        ? {
            registryUrl: env.AGENT_REGISTRY_URL,
            domainIntegrationKey: env.DOMAIN_INTEGRATION_KEY ?? "mediapulse",
            domainIntegrationApiKey: env.DOMAIN_INTEGRATION_API_KEY,
            agentUrl: env.AGENT_PUBLIC_URL,
          }
        : undefined,
  },
);

export async function performWebSearchWithQueries(
  queries: SearchQuery[],
): Promise<CollectedPage[]> {
  const results = await performWebSearch(queries, {
    serperApiKey: env.SERPER_API_KEY,
  });

  return results;
}

async function fetchWebPageContents(
  searchResults: WebSearchResult[],
): Promise<CollectedPage[]> {
  const pages = await performWebFetch(searchResults, {
    jinaApiKey: env.JINA_API_KEY,
  });

  return pages;
}

/**
 * Converts collected pages to the shared DataCollectionInput shape.
 */
function toDataCollectionInputs(
  tickerId: string,
  pages: CollectedPage[],
): DataCollectionInput[] {
  return pages.map((page) => ({
    url: page.url,
    title: page.title,
    content: page.content,
    tickerId,
    searchQueryId: page.searchQueryId,
  }));
}

export default {
  port: env.PORT ?? 4001,
  fetch: app.fetch,
};
