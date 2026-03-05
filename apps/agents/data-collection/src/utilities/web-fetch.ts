import got from "got";
import { sleep } from "@workspace/utils";

import type { WebSearchResult } from "./web-search.js";

export interface WebFetchDeps {
  /**
   * Jina AI API key used for content extraction.
   */
  jinaApiKey: string;
  /**
   * HTTP client implementation; defaults to got.
   */
  gotClient?: typeof got;
}

export type WebFetchResponse = {
  data?: { url?: string; title?: string; content?: string };
};

/**
 * Fetches and enriches web page contents for each search result using the Jina AI API.
 *
 * @param searchResults - Search results without full content.
 * @param deps - Dependencies including the Jina API key and HTTP client.
 * @returns A list of collected pages with full content populated.
 */
export async function performWebFetch(
  searchResults: WebSearchResult[],
  deps: WebFetchDeps,
): Promise<WebSearchResult[]> {
  const { jinaApiKey, gotClient = got } = deps;

  const pages: WebSearchResult[] = [];

  for (let index = 0; index < searchResults.length; index++) {
    if (index > 0 && index % 2 === 0) {
      await sleep(1_000);
    }

    const result = searchResults[index];

    const json = await gotClient
      .post("https://r.jina.ai/", {
        json: { url: result.url },
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${jinaApiKey}`,
        },
      })
      .json<WebFetchResponse>();

    pages.push({
      url: json.data?.url ?? result.url,
      title: json.data?.title ?? result.title,
      content: json.data?.content ?? "",
      tickerId: result.tickerId,
      searchQueryId: result.searchQueryId,
      searchQueryText: result.searchQueryText,
    });
  }

  return pages;
}
