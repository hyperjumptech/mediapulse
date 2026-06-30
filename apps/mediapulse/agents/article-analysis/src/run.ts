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

/** (article, ticker) pairs fetched per drain iteration (also bounded by the GET contract). */
const BATCH_SIZE = 100;
/** Safety bound on total pairs classified in a single run. */
const MAX_PAIRS_PER_RUN = 1000;
/** Max concurrent classification calls. */
const CLASSIFY_CONCURRENCY = 8;

type ClassifiedRow = {
  dataSourceId: string;
  tickerId: string;
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

  let totalScored = 0;
  let totalRejected = 0;
  let totalReturned = 0;
  let backlog = 0;
  let startReported = false;

  // Drain the recent unclassified backlog in batches until empty (or the per-run safety cap is hit).
  // Each posted batch upserts section rows, so the next fetch excludes those pairs and the loop
  // makes forward progress; a batch that classifies nothing means no progress is possible, so stop.
  while (totalReturned < MAX_PAIRS_PER_RUN) {
    const { dataSources, dataSourceTotalCount } =
      await dataApiClient.analysis.get({
        unanalyzed: true,
        limit: BATCH_SIZE,
      });
    backlog = dataSourceTotalCount;

    if (!startReported) {
      log.info(
        { returned: dataSources.length, backlog },
        "article-analysis run started",
      );
      report(...narrativeRunStart(dataSources.length));
      startReported = true;
    }

    if (dataSources.length === 0) {
      break;
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
          tickerId: dataSource.tickerId,
          section: result.section,
          score: result.score,
          reason: result.reason,
        };
      },
    );

    const articleSections = classified.filter(
      (row): row is ClassifiedRow => row !== null,
    );

    // No pair in this batch could be classified: no section rows would be written, so the same
    // pairs would be returned again. Stop to avoid an infinite loop.
    if (articleSections.length === 0) {
      break;
    }

    const analyzedDataSourceIds = [
      ...new Set(dataSources.map((dataSource) => dataSource.id)),
    ];

    const { articlesScored, articlesRejected } =
      await dataApiClient.analysis.create({
        articleSections,
        analyzedDataSourceIds,
      });

    totalScored += articlesScored;
    totalRejected += articlesRejected;
    totalReturned += dataSources.length;
    log.info(
      {
        batchScored: articlesScored,
        totalScored,
        remainingBacklog: Math.max(0, backlog - totalReturned),
      },
      "article-analysis batch completed",
    );
  }

  const totalAssigned = totalScored - totalRejected;

  log.info(
    { scored: totalScored, assigned: totalAssigned, rejected: totalRejected },
    "article-analysis run completed",
  );
  report(
    ...narrativeRunComplete({
      status: "success",
      scored: totalScored,
      assigned: totalAssigned,
      rejected: totalRejected,
    }),
    "completed",
  );

  return {
    success: true,
    message:
      totalScored === 0
        ? "No unanalyzed articles to classify."
        : `Classified ${totalScored} article(s): ${totalAssigned} assigned, ${totalRejected} rejected.`,
    details: {
      scored: totalScored,
      assigned: totalAssigned,
      rejected: totalRejected,
      backlog,
    },
  };
}
