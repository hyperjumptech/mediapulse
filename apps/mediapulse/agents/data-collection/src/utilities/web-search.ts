import got from "got";
import { z } from "zod";
import { sleep } from "@workspace/utils";

export interface SearchQuery {
  id: string;
  text: string;
  tickerId: string;
  source?: string;
  intent?: string;
  rank?: number;
  setId?: string;
}

export interface WebSearchResult {
  url: string;
  title: string;
  content: string;
  tickerId: string;
  searchQueryId: string;
  searchQueryText: string;
}

export interface WebSearchDeps {
  serperApiKey: string;
  gotClient?: typeof got;
}

/** Zod schema for Serper.dev API organic search result item. */
const serperOrganicItemSchema = z.object({
  link: z.string().optional(),
  title: z.string().optional(),
  snippet: z.string().optional(),
});

/** Zod schema for Serper.dev API search response. */
export const serperResponseSchema = z.object({
  organic: z.array(serperOrganicItemSchema).optional(),
});

export type SerperResponse = z.infer<typeof serperResponseSchema>;

/**
 * Performs web search for each query using the Serper.dev API and returns a web search result per query.
 *
 * @param queries - Search queries retrieved from the Agent Data API.
 * @param deps - Dependencies including the Serper API key.
 * @returns A list of web search results.
 */
export async function performWebSearch(
  queries: SearchQuery[],
  deps: WebSearchDeps,
): Promise<WebSearchResult[]> {
  const { serperApiKey, gotClient = got } = deps;
  const results: WebSearchResult[] = [];

  for (const [index, query] of queries.entries()) {
    if (index > 0 && index % 2 === 0) {
      await sleep(1_000);
    }

    const raw = await gotClient
      .post("https://google.serper.dev/search", {
        json: { q: query.text },
        headers: {
          "Content-Type": "application/json",
          "X-API-KEY": serperApiKey,
        },
      })
      .json<unknown>();

    const response = serperResponseSchema.parse(raw);

    for (const item of response.organic ?? []) {
      results.push({
        url: item.link ?? "",
        title: item.title ?? "",
        content: item.snippet ?? "",
        tickerId: query.tickerId,
        searchQueryId: query.id,
        searchQueryText: query.text,
      });
    }
  }

  return results;
}
