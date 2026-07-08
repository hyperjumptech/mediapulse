import { createAgentDataApiClient } from "@workspace/agent-data-api-client";
import {
  createTokenUsageAccumulator,
  type AgentRunContext,
  type AgentRunResult,
} from "@workspace/agent-runtime";
import { countQueryHits, createSearchProvider } from "@workspace/agent-search";
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
  QUERY_COUNT,
} from "./constants";
import { discoverEntities } from "./discovery/discover-entities";
import type { DiscoveredEntity } from "./discovery/schema";
import { deriveClassification, deriveMarketContext } from "./pipeline/context";
import { generateAndProbeCandidates } from "./generation/generate-and-probe";
import { finalizeQueries } from "./select/finalize";

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
  now?: () => number;
};

/**
 * Runs the self-driving query-analysis pipeline for one ticker and persists an
 * active query set.
 *
 * Flow: load GET context, derive classification, look up the `ticker_discovery`
 * cache (invalidated on TTL expiry or a contract-version change), discover
 * competitors/regulators on miss (steered by the contract brief) and write the
 * cache, generate query candidates via LLM (own-company/deals/competitor/
 * regulator/industry themes, steered by the contract brief), probe each for
 * yield, retry with targeted feedback on zero-hit candidates, guarantee section
 * coverage, and persist the ranked set.
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
  const createClient = deps.createClient ?? createAgentDataApiClient;
  const client = createClient({
    baseUrl: env.AGENT_DATA_API_URL,
    version: "v1",
    token,
  });

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

  report("Fetching ticker context", `ticker ${input.tickerId}`);
  const queryContext = await client.queryAnalysis.get({
    tickerId: input.tickerId,
  });
  const ticker = queryContext.ticker;
  const classification = deriveClassification(ticker);
  const market = deriveMarketContext();

  // Discovery: reuse the cache, LLM-discover on miss (or on a contract change), and write back.
  const discoveryStartMs = now();
  const lookup = await client.tickerDiscoveryLookup.create({
    tickerId: input.tickerId,
  });
  let competitors: DiscoveredEntity[] = lookup.entry?.competitors ?? [];
  let regulators: DiscoveredEntity[] = lookup.entry?.regulators ?? [];
  const cacheHit =
    lookup.entry !== null && lookup.entry.contractVersion === contractVersion;
  let discoveryModel: string | null = lookup.entry?.model ?? null;

  if (!cacheHit) {
    report(
      "Discovering competitors and regulators",
      `${ticker.symbol} (${ticker.name})`,
    );
    const discovered = await discoverEntities({
      tickerName: ticker.name,
      tickerSymbol: ticker.symbol,
      classification,
      homeMarket: market.homeMarket,
      contractBrief,
      ai: config.ai,
      maxCompetitors: DISCOVERY_MAX_COMPETITORS,
      maxRegulators: DISCOVERY_MAX_REGULATORS,
      maxKeywordsPerEntity: DISCOVERY_MAX_KEYWORDS_PER_ENTITY,
      onUsage: tokenUsage.onUsage,
      logger,
      ...(deps.generate ? { generate: deps.generate } : {}),
    });
    competitors = discovered.competitors;
    regulators = discovered.regulators;
    discoveryModel = config.ai.model;

    await client.tickerDiscoveryRecord.create({
      tickerId: input.tickerId,
      competitors: discovered.competitors,
      regulators: discovered.regulators,
      model: config.ai.model,
      ...(contractVersion !== null ? { contractVersion } : {}),
      ttlSeconds: DISCOVERY_CACHE_TTL_SECONDS,
    });
  }
  const discoveryMs = now() - discoveryStartMs;

  // Generate query candidates via LLM (own-company/deals/competitor/regulator/industry
  // themes), probe each for yield, and retry with feedback on zero-hit candidates.
  report("Generating query candidates", `${ticker.symbol} (${ticker.name})`);
  const generationStartMs = now();
  const generation = await generateAndProbeCandidates(
    {
      ticker,
      classification,
      market,
      contractBrief,
      competitors,
      regulators,
      languages: LANGUAGES,
      currentDate: new Date(now()).toISOString().slice(0, 10),
      ai: config.ai,
      onUsage: tokenUsage.onUsage,
      logger,
      providers: config.web_search,
      locales: PROBE_LOCALES,
      probeBudget: PROBE_BUDGET,
      probeConcurrency: PROBE_CONCURRENCY,
      probeMinResults: PROBE_MIN_RESULTS,
      probeTimeoutMs: PROBE_TIMEOUT_MS,
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

  const finalizeStartMs = now();
  const finalized = finalizeQueries({
    survivors: generation.survivors,
    dropped: generation.dropped,
    queryCount: QUERY_COUNT,
  });
  const finalizeMs = now() - finalizeStartMs;

  if (finalized.queries.length === 0) {
    logger.warn(
      {
        tickerId: input.tickerId,
        candidates: generation.telemetry.candidates,
      },
      "query-analysis produced no surviving queries; skipping persist",
    );

    return {
      success: false,
      message: "No query survived the yield probe.",
      details: { created: 0 },
    };
  }

  const usageTotals = tokenUsage.totals();
  const providerUsage = generation.telemetry.providerUsage.map((entry) => ({
    name: entry.name,
    calls: entry.calls,
  }));

  const strategySnapshot = {
    agentVersion: "3.0.0",
    generationSource: "self_driving_v1",
    ...(contract !== undefined ? { contractVersion: contract.version } : {}),
    llmUsage: {
      model: config.ai.model,
      promptTokens: usageTotals.promptTokens,
      completionTokens: usageTotals.completionTokens,
      totalTokens: usageTotals.totalTokens,
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
      generationMs,
      finalizeMs,
    },
    ...(discoveryModel !== null ? { discoveryModel } : {}),
  };

  report(
    "Saving query set",
    `${finalized.queries.length} queries`,
    "completed",
  );
  const response = await client.queryAnalysis.create({
    tickerId: input.tickerId,
    generationSource: "self_driving_v1",
    strategySnapshot,
    activate: true,
    queries: finalized.queries,
    ...(hermesCorrelation?.jobId !== undefined
      ? { agentJobId: hermesCorrelation.jobId }
      : {}),
  });

  logger.info(
    { tickerId: input.tickerId, created: response.created, cacheHit },
    "query analysis set persisted",
  );

  return { success: true, details: { ...response } };
};
