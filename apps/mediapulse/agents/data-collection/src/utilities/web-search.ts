import got from "got";
import { z } from "zod";
import { RateLimiter, withRetry } from "./resilience";
import { classifyError, isRetryableError } from "./error-classification";
import type { ConfigSchemaType } from "./config-schema";
import type { DataCollectionFailure } from "@workspace/agent-data-api-contract";

export interface SearchQuery {
  id: string;
  text: string;
  tickerId: string;
}

export interface WebSearchResult {
  url: string;
  title: string;
  content: string;
  tickerId: string;
  searchQueryId: string;
  searchQueryText: string;
}

export interface WebSearchSuccess {
  success: true;
  data: WebSearchResult;
}

export interface WebSearchFailure {
  success: false;
  queryId: string;
  queryText: string;
  tickerId: string;
  errorCategory: DataCollectionFailure["errorCategory"];
  message: string;
  retryable: boolean;
  httpStatus?: number;
}

export type WebSearchAttemptResult = WebSearchSuccess | WebSearchFailure;

export interface WebSearchDeps {
  config: NonNullable<ConfigSchemaType["webSearch"]>;
  gotClient?: typeof got;
}

/** Zod schema for Serper.dev API organic search result item. */
const serperOrganicItemSchema = z.object({
  link: z.string().url().optional(),
  title: z.string().optional(),
  snippet: z.string().optional(),
});

/** Zod schema for Serper.dev API search response. */
export const serperResponseSchema = z.object({
  organic: z.array(serperOrganicItemSchema).optional(),
});

export type SerperResponse = z.infer<typeof serperResponseSchema>;

/**
 * Performs web search for each query using the configured provider.
 * Uses config-driven limits, retries, and yields partial success items.
 *
 * @param queries - Search queries retrieved from the Agent Data API.
 * @param deps - Dependencies including runtime configuration.
 * @returns A list of web search attempt results.
 */
export async function performWebSearch(
  queries: SearchQuery[],
  deps: WebSearchDeps,
): Promise<WebSearchAttemptResult[]> {
  const { config, gotClient = got } = deps;
  const results: WebSearchAttemptResult[] = [];

  const rateLimiter = new RateLimiter(
    config.rateLimit.requests,
    config.rateLimit.perSeconds,
  );

  const authHeaders: Record<string, string> = {};
  if (config.authentication.apiKey && config.authentication.headerName) {
    const prefix = config.authentication.type === "bearer" ? "Bearer " : "";
    authHeaders[config.authentication.headerName] =
      `${prefix}${config.authentication.apiKey}`;
  }

  for (const query of queries) {
    try {
      await rateLimiter.acquire();

      const fetchTask = async () => {
        const raw = await gotClient
          .post(config.baseUrl, {
            json: { q: query.text },
            headers: {
              "Content-Type": "application/json",
              ...authHeaders,
            },
            timeout: config.timeoutMs
              ? { request: config.timeoutMs }
              : undefined,
          })
          .json<unknown>();

        const parsed = serperResponseSchema.safeParse(raw);
        if (!parsed.success) {
          throw parsed.error;
        }

        const organic = parsed.data.organic ?? [];
        if (organic.length === 0) {
          throw new Error("Semantic validation failed");
        }
        return organic;
      };

      const organic = config.retry
        ? await withRetry(fetchTask, config.retry, isRetryableError)
        : await fetchTask();

      for (const item of organic) {
        if (!item.link) {
          continue;
        }
        results.push({
          success: true,
          data: {
            url: item.link,
            title: item.title ?? "",
            content: item.snippet ?? "",
            tickerId: query.tickerId,
            searchQueryId: query.id,
            searchQueryText: query.text,
          },
        });
      }
    } catch (e) {
      const classified = classifyError(e);
      results.push({
        success: false,
        queryId: query.id,
        queryText: query.text,
        tickerId: query.tickerId,
        errorCategory: classified.category,
        message: classified.message,
        retryable: isRetryableError(e),
        httpStatus: classified.httpStatus,
      });
    }
  }

  return results;
}
