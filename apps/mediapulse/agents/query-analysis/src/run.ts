import { createAgentDataApiClient } from "@workspace/agent-data-api-client";
import {
  QUERY_ANALYSIS_INTENTS,
  type QueryDecision,
} from "@workspace/agent-data-api-contract";
import {
  createActivityReporter,
  createTokenUsageAccumulator,
  type AgentRunContext,
  type AgentRunResult,
} from "@workspace/agent-runtime";
import {
  createSearchProvider,
  searchTopResults,
} from "@workspace/agent-search";
import { generateObject } from "ai";
import { logger } from "@workspace/logger";
import { env } from "@mediapulse/env/agents-query-analysis";

import { type QueryAnalysisConfig } from "./config-schema";
import {
  LANGUAGES,
  QUERY_ANALYSIS_AGENT_ID,
  QUERY_ANALYSIS_AGENT_VERSION,
  DEFAULT_QUERIES_PER_INTENT,
  RECON_CONCURRENCY,
  RECON_LOCALE,
  RECON_MAX_COMPETITORS,
  RECON_MAX_QUERIES,
  RECON_MAX_SIGNALS,
  RECON_RESULTS_PER_QUERY,
  RECON_TIMEOUT_MS,
} from "./constants";
import { buildQueryDecisions } from "./chronicle/build-query-decisions";
import { gatherReconSignals } from "./recon/gather-signals";
import {
  deriveClassification,
  deriveMarketContext,
  deriveSearchClassification,
} from "./pipeline/context";
import { generateCandidatesWithCoverage } from "./generation/generate-with-coverage";
import { finalizeQueries } from "./select/finalize";
import { provenCandidates } from "./pipeline/proven";
import {
  narrativeRunStart,
  narrativeProfile,
  narrativeGenerating,
  narrativeRunComplete,
} from "./utilities/build-activity-narrative";

type QueryAnalysisInput = { tickerId: string };

/** Injectable collaborators for {@link runQueryAnalysis} (tests only). */
export type RunQueryAnalysisDeps = {
  createClient?: typeof createAgentDataApiClient;
  /** Injected `generateObject` for the query-candidate-generation LLM call. */
  generateQueries?: typeof generateObject;
  createProvider?: typeof createSearchProvider;
  /** Injected `searchTopResults` for the recon step. */
  reconSearch?: typeof searchTopResults;
  now?: () => number;
};

/**
 * Runs the self-driving query-analysis pipeline for one ticker and persists an
 * active query set.
 *
 * Flow: load GET context, read the curated ticker profile for competitors and
 * regulators, gather recent home-market signals via search, generate query
 * candidates via LLM (one intent per newsletter section, steered by the contract
 * brief), retry generation when an intent comes back short of its target, and
 * persist a fixed budget of queries per section.
 *
 * @param context - Agent run context with validated input/config, token, and contract.
 * @param deps - Injectable collaborators for tests.
 * @returns Success response with created query count, or failure when no query is generated.
 */
export const runQueryAnalysis = async (
  context: AgentRunContext<QueryAnalysisInput, QueryAnalysisConfig>,
  deps: RunQueryAnalysisDeps = {},
): Promise<AgentRunResult> => {
  const { input, config, token, hermesCorrelation, contract } = context;
  const now = deps.now ?? (() => Date.now());
  const runStartMs = now();
  const contractBrief = contract?.brief ?? "";
  const contractVersion = contract?.version ?? null;

  const tokenUsage = createTokenUsageAccumulator();
  const report = createActivityReporter({
    registryUrl: env.AGENT_REGISTRY_URL,
    jobId: hermesCorrelation?.jobId,
    token,
  });
  const createClient = deps.createClient ?? createAgentDataApiClient;
  const client = createClient({
    baseUrl: env.AGENT_DATA_API_URL,
    version: "v1",
    token,
  });

  // Best-effort chronicle write: records the per-query include/reject decision log for this run.
  // Any failure is logged and swallowed so it never affects the primary AgentRunResult.
  const writeChronicle = async (queries: QueryDecision[]): Promise<void> => {
    try {
      await client.queryAnalysisRuns.create({
        tickerId: input.tickerId,
        executionId: hermesCorrelation?.executionId ?? null,
        queries,
      });
    } catch (chronicleError) {
      logger.error(
        { err: chronicleError, tickerId: input.tickerId },
        "Failed to write query-analysis chronicle",
      );
    }
  };

  const queryContext = await client.queryAnalysis.get({
    tickerId: input.tickerId,
  });
  const ticker = queryContext.ticker;
  const profile = queryContext.profile;
  const classification = deriveClassification(ticker, profile);
  const searchClassification = deriveSearchClassification(ticker, profile);
  const market = deriveMarketContext();

  logger.info(
    {
      tickerId: input.tickerId,
      symbol: ticker.symbol,
      name: ticker.name,
      sector: classification.sector,
      industry: classification.industry,
      homeMarket: market.homeMarket,
      contractVersion,
    },
    "query analysis started",
  );

  const subject = { symbol: ticker.symbol, name: ticker.name };
  report(...narrativeRunStart(subject));

  const queriesPerIntent =
    config.generation?.queriesPerIntent ?? DEFAULT_QUERIES_PER_INTENT;

  const hasProfile = profile !== null;
  const competitors = profile?.competitors ?? [];
  const regulators = profile?.regulators ?? [];

  report(...narrativeProfile(subject, hasProfile));

  if (!hasProfile) {
    logger.warn(
      { tickerId: input.tickerId, symbol: ticker.symbol },
      "query-analysis has no curated ticker profile; generating own-company queries only",
    );
  } else {
    logger.info(
      {
        tickerId: input.tickerId,
        symbol: ticker.symbol,
        competitors: competitors.map((entity) => entity.name),
        regulators: regulators.map((entity) => entity.name),
      },
      "query analysis profile loaded",
    );
  }

  const reconStartMs = now();
  const reconSignals = await gatherReconSignals({
    ticker,
    classification: searchClassification,
    homeMarket: market.homeMarket,
    competitors,
    providers: config.web_search,
    locale: RECON_LOCALE,
    maxQueries: RECON_MAX_QUERIES,
    maxCompetitors: RECON_MAX_COMPETITORS,
    maxSignals: RECON_MAX_SIGNALS,
    resultsPerQuery: RECON_RESULTS_PER_QUERY,
    concurrency: RECON_CONCURRENCY,
    timeoutMs: RECON_TIMEOUT_MS,
    logger,
    ...(deps.createProvider ? { createProvider: deps.createProvider } : {}),
    ...(deps.reconSearch ? { search: deps.reconSearch } : {}),
  });
  const reconMs = now() - reconStartMs;

  logger.info(
    {
      tickerId: input.tickerId,
      symbol: ticker.symbol,
      signals: reconSignals.length,
      reconMs,
    },
    "query analysis recon complete",
  );

  report(
    ...narrativeGenerating(
      subject,
      queriesPerIntent,
      QUERY_ANALYSIS_INTENTS.length,
    ),
  );

  // Generate query candidates via LLM (one intent per newsletter section) and retry
  // generation when an intent comes back short of its per-intent target.
  const generationStartMs = now();
  const generation = await generateCandidatesWithCoverage({
    ticker,
    classification,
    market,
    contractBrief,
    competitors,
    regulators,
    ...(profile !== null
      ? {
          companyOverview: profile.companyOverview,
          businessOperation: profile.businessOperation,
        }
      : {}),
    reconSignals,
    languages: LANGUAGES,
    currentDate: new Date(now()).toISOString().slice(0, 10),
    queriesPerIntent,
    ai: config.language_model,
    onUsage: tokenUsage.onUsage,
    logger,
    ...(deps.generateQueries ? { generate: deps.generateQueries } : {}),
  });
  const generationMs = now() - generationStartMs;

  logger.info(
    {
      tickerId: input.tickerId,
      symbol: ticker.symbol,
      attempts: generation.attempts,
      candidates: generation.telemetry.candidates,
      deduped: generation.telemetry.deduped,
      generationMs,
    },
    "query analysis generation complete",
  );

  const finalizeStartMs = now();
  const finalized = finalizeQueries({
    candidates: [
      ...provenCandidates(queryContext.provenQueries ?? []),
      ...generation.candidates,
    ],
    queriesPerIntent,
    subject: {
      symbol: ticker.symbol,
      name: ticker.name,
      aliases: profile?.aliases ?? [],
      sectorTerms: [
        classification.sector,
        classification.industry,
        classification.subIndustry,
        classification.businessActivity,
      ].filter((term): term is string => typeof term === "string"),
      partyNames: [
        ...(profile?.competitors ?? []).flatMap((party) => [
          party.name,
          ...party.aliases,
        ]),
        ...(profile?.regulators ?? []).flatMap((party) => [
          party.name,
          ...party.aliases,
        ]),
      ],
    },
  });
  const finalizeMs = now() - finalizeStartMs;

  logger.info(
    {
      tickerId: input.tickerId,
      symbol: ticker.symbol,
      queryCount: finalized.queries.length,
      idCount: finalized.idCount,
      globalCount: finalized.globalCount,
      perIntent: finalized.perIntent,
      perSection: finalized.perSection,
      finalizeMs,
    },
    "query analysis finalize complete",
  );

  report(
    ...narrativeRunComplete(subject, {
      queryCount: finalized.queries.length,
      queriesPerIntent,
      perIntent: finalized.perIntent,
      attempts: generation.attempts,
    }),
    "completed",
  );

  const queryDecisions = buildQueryDecisions({
    candidates: generation.candidates,
    finalized: finalized.queries,
  });

  if (finalized.queries.length === 0) {
    logger.warn(
      {
        tickerId: input.tickerId,
        symbol: ticker.symbol,
        attempts: generation.attempts,
        candidates: generation.telemetry.candidates,
        deduped: generation.telemetry.deduped,
      },
      "query-analysis produced no queries; skipping persist",
    );
    await writeChronicle(queryDecisions);

    return {
      success: false,
      message: `No query was generated (${generation.telemetry.candidates} candidates generated across ${generation.attempts} attempts).`,
      details: { created: 0 },
    };
  }

  const usageTotals = tokenUsage.totals();

  const strategySnapshot = {
    agentVersion: QUERY_ANALYSIS_AGENT_VERSION,
    generationSource: "self_driving_v1",
    ...(contract !== undefined ? { contractVersion: contract.version } : {}),
    llmUsage: {
      model: config.language_model.model,
      promptTokens: usageTotals.promptTokens,
      completionTokens: usageTotals.completionTokens,
      totalTokens: usageTotals.totalTokens,
      reasoningTokens: usageTotals.reasoningTokens,
      calls: usageTotals.calls,
    },
    profile: {
      present: hasProfile,
      competitors: competitors.map((entity) => entity.name),
      regulators: regulators.map((entity) => entity.name),
    },
    generation: {
      attempts: generation.attempts,
      candidates: generation.telemetry.candidates,
      deduped: generation.telemetry.deduped,
    },
    output: {
      queryCount: finalized.queries.length,
      perIntent: finalized.perIntent,
      perSection: finalized.perSection,
      idCount: finalized.idCount,
      globalCount: finalized.globalCount,
      queries: finalized.queries.map((query) => query.text),
    },
    timing: {
      totalMs: now() - runStartMs,
      reconMs,
      generationMs,
      finalizeMs,
    },
  };

  await writeChronicle(queryDecisions);
  const response = await client.queryAnalysis.create({
    tickerId: input.tickerId,
    generationSource: "self_driving_v1",
    strategySnapshot,
    activate: true,
    queries: finalized.queries,
    agentId: QUERY_ANALYSIS_AGENT_ID,
    agentVersion: QUERY_ANALYSIS_AGENT_VERSION,
    ...(hermesCorrelation?.jobId !== undefined
      ? { agentJobId: hermesCorrelation.jobId }
      : {}),
  });

  logger.info(
    {
      tickerId: input.tickerId,
      symbol: ticker.symbol,
      created: response.created,
      hasProfile,
      totalMs: now() - runStartMs,
    },
    "query analysis set persisted",
  );

  return { success: true, details: { ...response } };
};
