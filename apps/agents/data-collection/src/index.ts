import type { DataSourceInput } from "@workspace/agent-types";
import {
  createAgentApp,
  dataApiGet,
  dataApiPost,
} from "@workspace/agent-runtime";
import { env } from "@workspace/env/agents-data-collection";
import got from "got";

import { z } from "zod";

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

type SearchQuery = {
  id: string;
  text: string;
  tickerId: string;
};

/** Internal shape for a collected page before sending to the API (includes searchQueryText for metadata). */
interface CollectedPage {
  url: string;
  title: string;
  content: string;
  tickerId: string;
  searchQueryId: string;
  searchQueryText?: string;
}

const app = createAgentApp<Input, typeof BodySchema>(
  {
    agentId: "data-collection",
    agentVersion: "1.0.0",
    inputSchema: BodySchema,
    run: async ({ input, token }) => {
      if (!env.JINA_API_KEY) {
        return {
          success: false,
          statusCode: 500,
          message: "JINA_API_KEY is not configured",
        };
      }
      if (!env.SERPER_API_KEY) {
        return {
          success: false,
          statusCode: 500,
          message: "SERPER_API_KEY is not configured",
        };
      }

      const query: Record<string, string> = { tickerId: input.tickerId };
      if (input.timeWindow) {
        query.start = input.timeWindow.start;
        query.end = input.timeWindow.end;
      }
      const { searchQueries: queries } = await dataApiGet<{
        searchQueries: SearchQuery[];
      }>(token, env.AGENT_DATA_API_URL, "/api/data-collection", query);
      const searchResults = await performWebSearchWithQueries(queries);
      const pages = await fetchWebPageContents(searchResults);

      if (pages.length > 0) {
        const sources = toDataSourceInputs(input.tickerId, pages);
        await dataApiPost(
          token,
          env.AGENT_DATA_API_URL,
          "/api/data-collection",
          sources,
        );
      }

      return { success: true };
    },
  },
  { authApiUrl: env.AGENT_AUTH_API_URL },
);

export async function performWebSearchWithQueries(
  queries: SearchQuery[],
): Promise<CollectedPage[]> {
  if (!queries.length) return [];

  const results = await Promise.all(
    queries.map(async (query) => {
      const data = await got
        .post("https://google.serper.dev/search", {
          json: { q: query.text },
          headers: {
            "Content-Type": "application/json",
            "X-API-KEY": env.SERPER_API_KEY,
          },
        })
        .json<{
          organic?: Array<{ link?: string; title?: string; snippet?: string }>;
        }>();
      const first = data?.organic?.[0];

      return {
        url: first?.link ?? "",
        title: first?.title ?? "",
        content: first?.snippet ?? "",
        tickerId: query.tickerId,
        searchQueryId: query.id,
        searchQueryText: query.text,
      };
    }),
  );

  return results;
}

async function fetchWebPageContents(
  searchResults: Omit<CollectedPage, "content">[],
): Promise<CollectedPage[]> {
  const fetchPages = searchResults.map(async (result) => {
    const json = await got
      .post("https://r.jina.ai/", {
        json: { url: result.url },
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.JINA_API_KEY}`,
        },
      })
      .json<{
        data?: { url?: string; title?: string; content?: string };
      }>();

    return {
      url: json.data?.url ?? result.url,
      title: json.data?.title ?? result.title,
      content: json.data?.content ?? "",
      tickerId: result.tickerId,
      searchQueryId: result.searchQueryId,
      searchQueryText: result.searchQueryText,
    };
  });

  return Promise.all(fetchPages);
}

/**
 * Converts collected pages to the shared DataSourceInput shape with optional metadata.
 */
function toDataSourceInputs(
  tickerId: string,
  pages: CollectedPage[],
): DataSourceInput[] {
  const fetchedAt = new Date().toISOString();
  return pages.map((page) => ({
    url: page.url,
    title: page.title,
    content: page.content,
    tickerId,
    searchQueryId: page.searchQueryId,
    metadata:
      page.searchQueryText != null
        ? {
            searchQueryText: page.searchQueryText,
            fetchedAt,
            sourceType: "web" as const,
          }
        : { fetchedAt, sourceType: "web" as const },
  }));
}

export default {
  port: env.PORT ?? 4001,
  fetch: app.fetch,
};
