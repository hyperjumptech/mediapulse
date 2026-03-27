import type { DataCollectionInput } from "@workspace/agent-types";
import { createAgentDataApiClient } from "@workspace/agent-data-api-client";
import { createAgentApp } from "@workspace/agent-runtime";
import { env } from "@mediapulse/env/agents-data-collection";
import crypto from "node:crypto";

import { z } from "zod";
import { ConfigSchema } from "./utilities/config-schema.js";
import { performWebFetch } from "./utilities/web-fetch.js";
import { performWebSearch } from "./utilities/web-search.js";

const BodySchema = z.object({
  tickerId: z.string().uuid(),
  timeWindow: z
    .object({
      start: z.string().datetime(),
      end: z.string().datetime(),
    })
    .optional(),
});

type Input = z.infer<typeof BodySchema>;
type Config = z.infer<typeof ConfigSchema>;

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
      const webSearchConfig = _config?.webSearch;

      const webFetchConfig = _config?.webFetch;

      const runPolicy = _config?.runPolicy ?? {
        minSuccessfulSources: 1,
        failOnZeroSuccess: true,
      };

      const dataApiClient = createAgentDataApiClient({
        baseUrl: env.AGENT_DATA_API_URL,
        version: "v1",
        token,
      });

      const startedAt = new Date();
      const runId = crypto.randomUUID();

      const query: { tickerId: string; start?: string; end?: string } = {
        tickerId: input.tickerId,
      };
      if (input.timeWindow) {
        query.start = input.timeWindow.start;
        query.end = input.timeWindow.end;
      }

      const { data: queries = [] } =
        await dataApiClient.dataCollection.get(query);

      const searchAttemptResults = await performWebSearch(queries, {
        config: webSearchConfig,
      });
      const searchSuccesses = searchAttemptResults
        .filter((r) => r.success)
        .map((r) => r.data);
      const searchFailures = searchAttemptResults.filter((r) => !r.success);

      const fetchAttemptResults = await performWebFetch(searchSuccesses, {
        config: webFetchConfig,
      });
      const fetchSuccesses = fetchAttemptResults
        .filter((r) => r.success)
        .map((r) => r.data);
      const fetchFailures = fetchAttemptResults.filter((r) => !r.success);

      if (fetchSuccesses.length > 0) {
        const sources: DataCollectionInput[] = fetchSuccesses.map((page) => ({
          url: page.url,
          title: page.title,
          content: page.content,
          tickerId: input.tickerId,
          searchQueryId: page.searchQueryId,
        }));
        await dataApiClient.dataCollection.create(sources);
      }

      const failuresPayload = [
        ...searchFailures.map((f) => ({
          id: crypto.randomUUID(),
          runId,
          tickerId: input.tickerId,
          stage: "web-search" as const,
          provider: "serper" as const,
          searchQueryId: f.queryId,
          errorCategory: f.errorCategory,
          retryable: f.retryable,
          message: f.message,
          httpStatus: f.httpStatus,
          createdAt: new Date().toISOString(),
        })),
        ...fetchFailures.map((f) => ({
          id: crypto.randomUUID(),
          runId,
          tickerId: input.tickerId,
          stage: "web-fetch" as const,
          provider: "jina" as const,
          searchQueryId: f.queryId,
          url: f.url,
          errorCategory: f.errorCategory,
          retryable: f.retryable,
          message: f.message,
          httpStatus: f.httpStatus,
          createdAt: new Date().toISOString(),
        })),
      ];

      if (failuresPayload.length > 0) {
        await dataApiClient.dataCollectionFailure.create(failuresPayload);
      }

      const totalSources = fetchSuccesses.length;
      let status: "success" | "partial_success" | "failed" = "success";

      if (failuresPayload.length > 0) {
        status = "partial_success";
      }

      if (
        totalSources < (runPolicy.minSuccessfulSources ?? 1) &&
        (runPolicy.failOnZeroSuccess ?? true)
      ) {
        status = "failed";
      }

      const runPayload = {
        id: runId,
        tickerId: input.tickerId,
        startedAt: startedAt.toISOString(),
        completedAt: new Date().toISOString(),
        status,
        counters: {
          queriesTotal: queries.length,
          urlsTotal: searchSuccesses.length,
          searchSuccess: searchSuccesses.length,
          searchFailed: searchFailures.length,
          fetchSuccess: fetchSuccesses.length,
          fetchFailed: fetchFailures.length,
          retryCount: 0,
        },
      };

      await dataApiClient.dataCollectionRun.create(runPayload);

      if (status === "failed") {
        throw new Error(
          "Data collection run failed due to validation or zero successes.",
        );
      }

      return {
        success: true,
        details: {
          summary: {
            totalSources,
            status,
            searchSuccess: searchSuccesses.length,
            fetchSuccess: fetchSuccesses.length,
          },
        },
      };
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

export default {
  port: env.PORT ?? 4001,
  fetch: app.fetch,
};
