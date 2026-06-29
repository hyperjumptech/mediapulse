import { createAgentDataApiClient } from "@workspace/agent-data-api-client";
import type { AgentRunContext, AgentRunResult } from "@workspace/agent-runtime";
import { env } from "@mediapulse/env/agents-article-analysis";
import { logger } from "@workspace/logger";
import crypto from "node:crypto";

import type { ArticleAnalysisConfig } from "./config-schema.js";
import type { ArticleAnalysisInput } from "./schemas/article-analysis-input-schema.js";
import {
  classifyArticleSection,
  renderArticleTickerContext,
} from "./llm-classify-section.js";
import {
  narrativeRunStart,
  narrativeClassifying,
  narrativeRunComplete,
} from "./utilities/build-activity-narrative.js";

/** Max data sources fetched and classified per run (also bounded by the GET contract). */
const MAX_SOURCES = 10;
/** Max concurrent classification calls. */
const CLASSIFY_CONCURRENCY = 4;

type ClassifiedRow = {
  dataSourceId: string;
  section: string | null;
  score: number;
  reason: string;
};

/**
 * Runs each item through `worker` with bounded concurrency, preserving input order.
 *
 * @param items - Inputs to process.
 * @param limit - Max in-flight workers.
 * @param worker - Async mapper.
 * @returns Results in the same order as `items` (failed items are `null`).
 */
async function mapWithConcurrency<TIn, TOut>(
  items: TIn[],
  limit: number,
  worker: (item: TIn, index: number) => Promise<TOut>,
): Promise<(TOut | null)[]> {
  const results: (TOut | null)[] = new Array(items.length).fill(null);
  let cursor = 0;

  const runners = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (cursor < items.length) {
        const index = cursor++;
        try {
          results[index] = await worker(items[index]!, index);
        } catch (error) {
          logger.error(
            { err: error, index },
            "article-analysis classification failed",
          );
          results[index] = null;
        }
      }
    },
  );

  await Promise.all(runners);

  return results;
}

/**
 * Loads unanalyzed articles, classifies each into one newsletter section (or rejects it) with a
 * score and reason, then persists the classifications and marks the articles analyzed.
 *
 * @param context - Validated input and config plus the Agent Data API bearer token.
 * @returns Success with summary counts, or a semantic failure when nothing could be classified.
 */
export async function run(
  context: AgentRunContext<ArticleAnalysisInput, ArticleAnalysisConfig>,
): Promise<AgentRunResult> {
  const { config, token, hermesCorrelation } = context;
  const runId = crypto.randomUUID();
  const log = logger.child({ component: "article-analysis", runId });

  const report = (
    title: string,
    description?: string,
    status: "processing" | "completed" = "processing",
  ) => {
    const jobId = hermesCorrelation?.jobId;
    if (jobId && token) {
      void fetch(`${env.AGENT_REGISTRY_URL}/api/agent-activity`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: token },
        body: JSON.stringify({ jobId, title, description, status }),
      }).catch(() => {});
    }
  };

  const dataApiClient = createAgentDataApiClient({
    baseUrl: env.AGENT_DATA_API_URL,
    version: "v1",
    token,
  });

  const { dataSources, dataSourceTotalCount } =
    await dataApiClient.analysis.get({
      unanalyzed: true,
      limit: MAX_SOURCES,
    });

  log.info(
    { returned: dataSources.length, backlog: dataSourceTotalCount },
    "article-analysis run started",
  );
  report(...narrativeRunStart(dataSources.length));

  if (dataSources.length === 0) {
    report(
      ...narrativeRunComplete({
        status: "success",
        scored: 0,
        assigned: 0,
        rejected: 0,
      }),
      "completed",
    );
    return {
      success: true,
      message: "No unanalyzed articles to classify.",
      details: {
        scored: 0,
        assigned: 0,
        rejected: 0,
        backlog: dataSourceTotalCount,
      },
    };
  }

  report(...narrativeClassifying(dataSources.length));

  const classified = await mapWithConcurrency(
    dataSources,
    CLASSIFY_CONCURRENCY,
    async (dataSource): Promise<ClassifiedRow> => {
      const tickerContext = renderArticleTickerContext(dataSource.ticker);
      const result = await classifyArticleSection({
        apiKey: config.acceptance.apiKey,
        baseUrl: config.acceptance.baseUrl,
        model: config.acceptance.model,
        title: dataSource.title,
        content: dataSource.content,
        acceptanceCriteria: config.acceptanceCriteria,
        ...(tickerContext ? { tickerContext } : {}),
      });

      return {
        dataSourceId: dataSource.id,
        section: result.section,
        score: result.score,
        reason: result.reason,
      };
    },
  );

  const articleSections = classified.filter(
    (row): row is ClassifiedRow => row !== null,
  );

  if (articleSections.length === 0) {
    report(
      ...narrativeRunComplete({
        status: "failed",
        scored: 0,
        assigned: 0,
        rejected: 0,
      }),
      "completed",
    );
    return {
      success: false,
      message: "Failed to classify any articles this run.",
      details: { returned: dataSources.length, scored: 0 },
    };
  }

  // Every fetched source is marked analyzed, even if its classification call failed.
  const analyzedDataSourceIds = dataSources.map((dataSource) => dataSource.id);

  const { articlesScored, articlesRejected } =
    await dataApiClient.analysis.create({
      articleSections,
      analyzedDataSourceIds,
    });

  const assigned = articlesScored - articlesRejected;

  log.info(
    { scored: articlesScored, assigned, rejected: articlesRejected },
    "article-analysis run completed",
  );
  report(
    ...narrativeRunComplete({
      status: "success",
      scored: articlesScored,
      assigned,
      rejected: articlesRejected,
    }),
    "completed",
  );

  return {
    success: true,
    message: `Classified ${articlesScored} article(s): ${assigned} assigned, ${articlesRejected} rejected.`,
    details: {
      returned: dataSources.length,
      scored: articlesScored,
      assigned,
      rejected: articlesRejected,
      backlog: dataSourceTotalCount,
    },
  };
}
