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
  countQueryHits,
  createSearchProvider,
  searchTopResults,
} from "@workspace/agent-search";
import { generateObject } from "ai";
import { logger } from "@workspace/logger";
import { env } from "@mediapulse/env/agents-query-analysis";

import { type QueryAnalysisConfig } from "./config-schema";
import {
  DISCOVERY_CACHE_TTL_SECONDS,
  DISCOVERY_MAX_COMPETITORS,
  DISCOVERY_MAX_KEYWORDS_PER_ENTITY,
  DISCOVERY_MAX_REGULATORS,
  LANGUAGES,
  PROBE_BUDGET,
  PROBE_CONCURRENCY,
  PROBE_LOCALES,
  PROBE_MIN_RESULTS,
  PROBE_TIMEOUT_MS,
  QUERY_ANALYSIS_AGENT_ID,
  QUERY_ANALYSIS_AGENT_VERSION,
  DEFAULT_QUERIES_PER_INTENT,
  RECON_CONCURRENCY,
  RECON_MAX_COMPETITORS,
  RECON_MAX_QUERIES,
  RECON_MAX_SIGNALS,
  RECON_RESULTS_PER_QUERY,
  RECON_TIMEOUT_MS,
} from "./constants";
import { buildQueryDecisions } from "./chronicle/build-query-decisions";
import { gatherReconSignals } from "./recon/gather-signals";
import { discoverEntities } from "./discovery/discover-entities";
import type { DiscoveredEntity } from "./discovery/schema";
import { deriveClassification, deriveMarketContext } from "./pipeline/context";
import { generateAndProbeCandidates } from "./generation/generate-and-probe";
import { finalizeQueries } from "./select/finalize";
import {
  narrativeRunStart,
  narrativeDiscovery,
  narrativeGenerating,
  narrativeProbing,
  narrativeRunComplete,
} from "./utilities/build-activity-narrative";

type QueryAnalysisInput = { tickerId: string };

/** Injectable collaborators for {@link runQueryAnalysis} (tests only). */
export type RunQueryAnalysisDeps = {
  createClient?: typeof createAgentDataApiClient;
  /** Injected `generateObject` for the entity-discovery LLM call. */
  generate?: typeof generateObject;
  /** Injected `generateObject` for the query-candidate-generation LLM call (separate from `generate`). */
  generateQueries?: typeof generateObject;
  countHits?: typeof countQueryHits;
  createProvider?: typeof createSearchProvider;
  /** Injected `searchTopResults` for the recon step. */
  reconSearch?: typeof searchTopResults;
  now?: () => number;
};

/**
 * Runs the self-driving query-analysis pipeline for one ticker and persists an
 * active query set.
 *
 * Flow: load GET context, derive classification, look up the `ticker_discovery`
 * cache (invalidated on TTL expiry or a contract-version change), discover
 * competitors/regulators on miss (steered by the contract brief) and write the
 * cache, generate query candidates via LLM (one intent per newsletter section,
 * steered by the contract brief), probe each for yield, retry with targeted
 * feedback on zero-hit candidates, and persist a fixed budget of queries per
 * section.
 *
 * @param context - Agent run context with validated input/config, token, and contract.
 * @param deps - Injectable collaborators for tests.
 * @returns Success response with created query count, or failure when no query survives.
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
  const classification = deriveClassification(ticker);
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

  // Discovery: reuse the cache, LLM-discover on miss (or on a contract change), and write back.
  const discoveryStartMs = now();
  const lookup = await client.tickerDiscoveryLookup.create({
    tickerId: input.tickerId,
  });
  let competitors: DiscoveredEntity[] = lookup.entry?.competitors ?? [];
  let regulators: DiscoveredEntity[] = lookup.entry?.regulators ?? [];
  let mainInputs: string[] = lookup.entry?.mainInputs ?? [];
  let customerSegments: string[] = lookup.entry?.customerSegments ?? [];
  const cacheHit =
    lookup.entry !== null && lookup.entry.contractVersion === contractVersion;
  let discoveryModel: string | null = lookup.entry?.model ?? null;

  report(...narrativeDiscovery(subject, cacheHit));

  if (!cacheHit) {
    const discovered = await discoverEntities({
      tickerName: ticker.name,
      tickerSymbol: ticker.symbol,
      classification,
      homeMarket: market.homeMarket,
      contractBrief,
      ai: config.language_model,
      maxCompetitors: DISCOVERY_MAX_COMPETITORS,
      maxRegulators: DISCOVERY_MAX_REGULATORS,
      maxKeywordsPerEntity: DISCOVERY_MAX_KEYWORDS_PER_ENTITY,
      onUsage: tokenUsage.onUsage,
      logger,
      ...(deps.generate ? { generate: deps.generate } : {}),
    });
    competitors = discovered.competitors;
    regulators = discovered.regulators;
    mainInputs = discovered.mainInputs;
    customerSegments = discovered.customerSegments;
    discoveryModel = config.language_model.model;

    const discoveredHasContent =
      discovered.competitors.length > 0 ||
      discovered.regulators.length > 0 ||
      discovered.mainInputs.length > 0 ||
      discovered.customerSegments.length > 0;

    if (discoveredHasContent) {
      await client.tickerDiscoveryRecord.create({
        tickerId: input.tickerId,
        competitors: discovered.competitors,
        regulators: discovered.regulators,
        mainInputs: discovered.mainInputs,
        customerSegments: discovered.customerSegments,
        model: config.language_model.model,
        ...(contractVersion !== null ? { contractVersion } : {}),
        ttlSeconds: DISCOVERY_CACHE_TTL_SECONDS,
      });
    }
  }
  const discoveryMs = now() - discoveryStartMs;

  logger.info(
    {
      tickerId: input.tickerId,
      symbol: ticker.symbol,
      cacheHit,
      discoveryModel,
      competitors: competitors.map((entity) => entity.name),
      regulators: regulators.map((entity) => entity.name),
      mainInputs,
      customerSegments,
      discoveryMs,
    },
    "query analysis discovery complete",
  );

  const reconStartMs = now();
  const reconSignals = await gatherReconSignals({
    ticker,
    classification,
    homeMarket: market.homeMarket,
    competitors,
    providers: config.web_search,
    locale: PROBE_LOCALES[0] ?? { gl: "id", hl: "id" },
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

  // Generate query candidates via LLM (one intent per newsletter section), probe each
  // for yield, and retry with feedback on zero-hit candidates.
  const generationStartMs = now();
  const generation = await generateAndProbeCandidates(
    {
      ticker,
      classification,
      market,
      contractBrief,
      competitors,
      regulators,
      mainInputs,
      customerSegments,
      reconSignals,
      languages: LANGUAGES,
      currentDate: new Date(now()).toISOString().slice(0, 10),
      ai: config.language_model,
      onUsage: tokenUsage.onUsage,
      logger,
      providers: config.web_search,
      locales: PROBE_LOCALES,
      probeBudget: PROBE_BUDGET,
      probeConcurrency: PROBE_CONCURRENCY,
      probeMinResults: PROBE_MIN_RESULTS,
      probeTimeoutMs: PROBE_TIMEOUT_MS,
      queriesPerIntent,
      ...(deps.generateQueries ? { generate: deps.generateQueries } : {}),
    },
    {
      probeDeps: {
        ...(deps.countHits ? { countHits: deps.countHits } : {}),
        ...(deps.createProvider ? { createProvider: deps.createProvider } : {}),
      },
    },
  );
  const generationMs = now() - generationStartMs;

  report(...narrativeProbing(generation.telemetry.deduped));

  logger.info(
    {
      tickerId: input.tickerId,
      symbol: ticker.symbol,
      attempts: generation.attempts,
      candidates: generation.telemetry.candidates,
      deduped: generation.telemetry.deduped,
      survivors: generation.telemetry.survivors,
      dropped: generation.telemetry.dropped.length,
      searchCredits: generation.telemetry.searchCredits,
      providerUsage: generation.telemetry.providerUsage,
      generationMs,
    },
    "query analysis generation and probe complete",
  );

  const finalizeStartMs = now();
  const finalized = finalizeQueries({
    survivors: generation.survivors,
    dropped: generation.dropped,
    queriesPerIntent,
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
      zeroYieldCount: generation.telemetry.dropped.length,
    }),
    "completed",
  );

  const queryDecisions = buildQueryDecisions({
    survivors: generation.survivors,
    dropped: generation.dropped,
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
        dropped: generation.telemetry.dropped.length,
        searchCredits: generation.telemetry.searchCredits,
      },
      "query-analysis produced no surviving queries; skipping persist",
    );
    await writeChronicle(queryDecisions);

    return {
      success: false,
      message: `No query survived the yield probe (${generation.telemetry.candidates} candidates generated, ${generation.telemetry.dropped} dropped for zero search yield).`,
      details: { created: 0 },
    };
  }

  const usageTotals = tokenUsage.totals();
  const providerUsage = generation.telemetry.providerUsage.map((entry) => ({
    name: entry.name,
    calls: entry.calls,
  }));

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
      cacheHit,
    },
    providerUsage: {
      searchProvider: providerUsage,
      searchCredits: generation.telemetry.searchCredits,
    },
    discovered: {
      competitors: competitors.map((entity) => entity.name),
      regulators: regulators.map((entity) => entity.name),
    },
    generation: {
      attempts: generation.attempts,
    },
    probe: {
      candidates: generation.telemetry.candidates,
      deduped: generation.telemetry.deduped,
      droppedZeroYield: generation.telemetry.dropped,
      survivors: generation.telemetry.survivors,
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
      discoveryMs,
      reconMs,
      generationMs,
      finalizeMs,
    },
    ...(discoveryModel !== null ? { discoveryModel } : {}),
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
      cacheHit,
      totalMs: now() - runStartMs,
    },
    "query analysis set persisted",
  );

  return { success: true, details: { ...response } };
};
