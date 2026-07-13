import { createAgentDataApiClient } from "@workspace/agent-data-api-client";
import {
  createTokenUsageAccumulator,
  type AgentRunContext,
  type AgentRunResult,
} from "@workspace/agent-runtime";
import { env } from "@mediapulse/env/agents-article-analysis";
import { logger } from "@workspace/logger";
import type { PostAnalysisScoreBreakdown } from "@workspace/agent-data-api-contract";
import crypto from "node:crypto";

import type { ArticleAnalysisConfig } from "./config-schema.js";
import type { ArticleAnalysisInput } from "./schemas/article-analysis-input-schema.js";
import {
  classifyArticleSection,
  rejectEmptySource,
  renderArticleTickerContext,
} from "./llm-classify-section.js";
import {
  narrativeRunStart,
  narrativeClassifying,
  narrativeRunComplete,
  type AnalysisStopReason,
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
  scoreBreakdown: PostAnalysisScoreBreakdown;
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
  const { config, token, hermesCorrelation, contract } = context;
  const runId = crypto.randomUUID();
  const startedAt = new Date();
  // Chronicle instrumentation: accumulate classification LLM token usage across the run.
  const tokenUsage = createTokenUsageAccumulator();
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
  let failureCount = 0;
  let totalSkippedByCap = 0;
  let totalCappedTickers = 0;
  let backlog = 0;
  let startReported = false;
  let stopReason: AnalysisStopReason = null;

  // Drain the recent unclassified backlog in batches until empty (or the per-run safety cap is hit).
  // Each posted batch upserts section rows, so the next fetch excludes those pairs and the loop
  // makes forward progress; a batch that classifies nothing means no progress is possible, so stop.
  while (true) {
    if (totalReturned >= MAX_PAIRS_PER_RUN) {
      stopReason = "max_pairs_reached";
      break;
    }

    const { dataSources, dataSourceTotalCount } =
      await dataApiClient.analysis.get({
        unanalyzed: true,
        limit: BATCH_SIZE,
      });
    backlog = dataSourceTotalCount;

    if (!startReported) {
      log.info({ backlog }, "article-analysis run started");
      report(...narrativeRunStart(backlog));
      startReported = true;
    }

    if (dataSources.length === 0) {
      stopReason = totalReturned === 0 ? "nothing_to_do" : "drained";
      break;
    }

    report(...narrativeClassifying(dataSources.length, totalReturned, backlog));

    const classified = await mapWithConcurrency(
      dataSources,
      CLASSIFY_CONCURRENCY,
      async (dataSource): Promise<ClassifiedRow> => {
        const classifiedText =
          dataSource.description ?? dataSource.content ?? "";
        const tickerContext = renderArticleTickerContext(dataSource.ticker);
        const result =
          classifiedText.trim() === ""
            ? rejectEmptySource(config.acceptanceCriteria)
            : await classifyArticleSection({
                apiKey: config.acceptance.apiKey,
                baseUrl: config.acceptance.baseUrl,
                model: config.acceptance.model,
                title: dataSource.title,
                content: classifiedText,
                acceptanceCriteria: config.acceptanceCriteria,
                ...(tickerContext ? { tickerContext } : {}),
                ...(contract?.brief ? { brief: contract.brief } : {}),
                onUsage: tokenUsage.onUsage,
              });

        return {
          dataSourceId: dataSource.id,
          tickerId: dataSource.tickerId,
          section: result.section,
          score: result.score,
          reason: result.reason,
          scoreBreakdown: result.scoreBreakdown,
        };
      },
    );

    const articleSections = classified.filter(
      (row): row is ClassifiedRow => row !== null,
    );
    failureCount += dataSources.length - articleSections.length;

    // No pair in this batch could be classified: no section rows would be written, so the same
    // pairs would be returned again. Stop to avoid an infinite loop.
    if (articleSections.length === 0) {
      stopReason = "no_progress";
      break;
    }

    const analyzedDataSourceIds = [
      ...new Set(dataSources.map((dataSource) => dataSource.id)),
    ];

    const {
      articlesScored,
      articlesRejected,
      skippedByCap,
      cappedTickerCount,
    } = await dataApiClient.analysis.create({
      articleSections,
      analyzedDataSourceIds,
    });

    totalScored += articlesScored;
    totalRejected += articlesRejected;
    totalSkippedByCap += skippedByCap;
    totalCappedTickers += cappedTickerCount;
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
  const status: "success" | "partial_success" | "failed" =
    totalScored > 0
      ? failureCount > 0
        ? "partial_success"
        : "success"
      : stopReason === "nothing_to_do"
        ? "success"
        : "failed";

  log.info(
    {
      status,
      scored: totalScored,
      assigned: totalAssigned,
      rejected: totalRejected,
      failed: failureCount,
      skippedByCap: totalSkippedByCap,
      cappedTickers: totalCappedTickers,
      stopReason,
    },
    "article-analysis run completed",
  );
  report(
    ...narrativeRunComplete({
      status,
      scored: totalScored,
      assigned: totalAssigned,
      rejected: totalRejected,
      failureCount,
      skippedByCap: totalSkippedByCap,
      stopReason,
    }),
    "completed",
  );

  // Chronicle instrumentation: persist a run record (tokens/model/timing/counts).
  // Article analysis drains a cross-ticker backlog, so the run is not tied to one
  // ticker; the Chronicle aggregates these by window. Best-effort: a failure here
  // must not fail the run.
  const usageTotals = tokenUsage.totals();
  try {
    await dataApiClient.articleAnalysisRun.create({
      id: runId,
      ...(hermesCorrelation?.scheduleExecutionId
        ? { scheduleExecutionId: hermesCorrelation.scheduleExecutionId }
        : {}),
      startedAt: startedAt.toISOString(),
      completedAt: new Date().toISOString(),
      status,
      model: config.acceptance.model,
      promptTokens: usageTotals.promptTokens,
      completionTokens: usageTotals.completionTokens,
      totalTokens: usageTotals.totalTokens,
      scored: totalScored,
      rejected: totalRejected,
      backlog,
      ...(stopReason !== null ? { stopReason } : {}),
      durationMs: Date.now() - startedAt.getTime(),
    });
  } catch (error) {
    log.warn(
      { err: error },
      "failed to persist article-analysis run record; continuing",
    );
  }

  return {
    success: status !== "failed",
    message:
      totalScored === 0
        ? "No unanalyzed articles to classify."
        : `Classified ${totalScored} article(s): ${totalAssigned} assigned, ${totalRejected} rejected.`,
    details: {
      scored: totalScored,
      assigned: totalAssigned,
      rejected: totalRejected,
      failed: failureCount,
      skippedByCap: totalSkippedByCap,
      cappedTickers: totalCappedTickers,
      backlog,
    },
  };
}
