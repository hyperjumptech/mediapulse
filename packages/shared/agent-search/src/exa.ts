import { z } from "zod";
import { HOST_WIDE_BLOCKED_DOMAINS } from "@workspace/utils";

import { RECENCY_DAYS, RESULTS_PER_QUERY } from "./constants";

import type {
  SearchHit,
  SearchProvider,
  SearchProviderContext,
  SearchProviderResult,
} from "./types";

const EXA_SEARCH_URL = "https://api.exa.ai/search";

/** Exa highlight extraction settings sent with the search request. */
export interface ExaHighlightsConfig {
  maxCharacters: number;
  query: string;
}

/** Configuration for the Exa search provider. */
export interface ExaSearchConfig {
  apiKey: string;
  highlights?: ExaHighlightsConfig;
}

const exaResultSchema = z.object({
  title: z.string().optional(),
  url: z.string().optional(),
  highlights: z.array(z.string()).optional(),
  publishedDate: z.string().optional(),
});

const exaResponseSchema = z.object({
  results: z.array(exaResultSchema).optional(),
});

const parseExaResponse = (raw: unknown): SearchHit[] => {
  const parsed = exaResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw parsed.error;
  }

  const items = parsed.data.results ?? [];

  return items
    .filter((item): item is { url: string } & typeof item => Boolean(item.url))
    .map((item) => {
      const snippet = (item.highlights ?? [])
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();

      return {
        url: item.url,
        title: item.title ?? "",
        snippet,
        ...(item.publishedDate ? { publishedAt: item.publishedDate } : {}),
      };
    });
};

/** Returns the ISO start date for the recency window. */
const recencyStartDate = (): string =>
  new Date(Date.now() - RECENCY_DAYS * 24 * 60 * 60 * 1000).toISOString();

const searchExa = async (
  config: ExaSearchConfig,
  queryText: string,
  ctx: SearchProviderContext,
): Promise<SearchProviderResult> => {
  const response = await ctx.gotClient.post(EXA_SEARCH_URL, {
    json: {
      query: queryText,
      numResults: RESULTS_PER_QUERY,
      type: "fast",
      category: "news",
      userLocation: ctx.locale.gl.toUpperCase(),
      excludeDomains: HOST_WIDE_BLOCKED_DOMAINS,
      startPublishedDate: recencyStartDate(),
      ...(config.highlights
        ? {
            contents: {
              highlights: {
                query: config.highlights.query,
                maxCharacters: config.highlights.maxCharacters,
              },
            },
          }
        : {}),
    },
    headers: {
      "x-api-key": config.apiKey,
      "Content-Type": "application/json",
    },
    timeout: { request: ctx.timeoutMs },
  });

  return { hits: parseExaResponse(JSON.parse(response.body)) };
};

/**
 * Creates an Exa news search provider.
 *
 * @param config - Exa API key and optional highlight settings.
 */
export const createExaSearchProvider = (
  config: ExaSearchConfig,
): SearchProvider => ({
  type: "exa",
  search: (queryText, ctx) => searchExa(config, queryText, ctx),
});
