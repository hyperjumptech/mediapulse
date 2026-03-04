import got from "got";
import { sleep } from "@workspace/utils";

export interface WebSearchResult {
  url: string;
  title: string;
  description: string;
}

export interface WebSearchDeps {
  serperApiKey: string;
}

export type SerperResponse = {
  organic?: Array<{
    link?: string;
    title?: string;
    snippet?: string;
  }>;
};

/**
 * Performs web search for each query using the Serper.dev API and returns a web search result per query.
 *
 * @param queries - Search queries retrieved from the Agent Data API.
 * @param deps - Dependencies including the Serper API key.
 * @returns A list of web search results.
 */
export async function performWebSearch(
  queries: string[],
  deps: WebSearchDeps,
): Promise<WebSearchResult[]> {
  const { serperApiKey } = deps;
  const results: WebSearchResult[] = [];

  for (const [index, query] of queries.entries()) {
    if (index > 0 && index % 2 === 0) {
      await sleep(1_000);
    }

    const response = await got
      .post("https://google.serper.dev/search", {
        json: { q: query },
        headers: {
          "Content-Type": "application/json",
          "X-API-KEY": serperApiKey,
        },
      })
      .json<SerperResponse>();

    for (const item of response?.organic ?? []) {
      results.push({
        url: item.link ?? "",
        title: item.title ?? "",
        description: item.snippet ?? "",
      });
    }
  }

  return results;
}
