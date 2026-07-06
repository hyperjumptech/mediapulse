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
import { buildCompetitorCandidates } from "./pipeline/stage-competitors";
import { buildIndustryCandidates } from "./pipeline/stage-industry";
import { buildOwnCompanyCandidates } from "./pipeline/stage-own-company";
import { buildRegulatorCandidates } from "./pipeline/stage-regulators";
import { runYieldProbe } from "./probe/yield-probe";
import { finalizeQueries } from "./select/finalize";

type QueryAnalysisInput = { tickerId: string };

/** Injectable collaborators for {@link runQueryAnalysis} (tests only). */
export type RunQueryAnalysisDeps = {
  createClient?: typeof createAgentDataApiClient;
  generate?: typeof generateObject;
  countHits?: typeof countQueryHits;
  createProvider?: typeof createSearchProvider;
  now?: () => number;
};

/**
 * Runs the self-driving query-analysis pipeline for one ticker and persists an
 * active query set.
 *
 * Flow: load GET context, derive classification, look up the `ticker_discovery`
 * cache, discover competitors/regulators on miss (steered by the contract brief)
 * and write the cache, build own-company + competitor + regulator + industry
 * candidates across Indonesian and English, probe each for yield, drop
 * zero-result queries, guarantee section coverage, and persist the ranked set.
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

  // Discovery: reuse the cache, LLM-discover on miss, and write back.
  const discoveryStartMs = now();
  const lookup = await client.tickerDiscoveryLookup.create({
    tickerId: input.tickerId,
  });
  let competitors: DiscoveredEntity[] = lookup.entry?.competitors ?? [];
  let regulators: DiscoveredEntity[] = lookup.entry?.regulators ?? [];
  const cacheHit = lookup.entry !== null;
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
      ttlSeconds: DISCOVERY_CACHE_TTL_SECONDS,
    });
  }
  const discoveryMs = now() - discoveryStartMs;

  // Build entity-specific candidates across Indonesian + English.
  const candidates = [
    ...buildOwnCompanyCandidates(ticker, LANGUAGES),
    ...buildCompetitorCandidates(
      competitors,
      LANGUAGES,
      DISCOVERY_MAX_KEYWORDS_PER_ENTITY,
    ),
    ...buildRegulatorCandidates(
      regulators,
      LANGUAGES,
      DISCOVERY_MAX_KEYWORDS_PER_ENTITY,
    ),
    ...buildIndustryCandidates(classification, market, LANGUAGES),
  ];

  report("Probing query yield", `${candidates.length} candidates`);
  const probeStartMs = now();
  const probe = await runYieldProbe(
    {
      candidates,
      providers: config.web_search,
      locales: PROBE_LOCALES,
      budget: PROBE_BUDGET,
      concurrency: PROBE_CONCURRENCY,
      minResults: PROBE_MIN_RESULTS,
      timeoutMs: PROBE_TIMEOUT_MS,
      logger,
    },
    {
      ...(deps.countHits ? { countHits: deps.countHits } : {}),
      ...(deps.createProvider ? { createProvider: deps.createProvider } : {}),
    },
  );
  const probeMs = now() - probeStartMs;

  const finalizeStartMs = now();
  const finalized = finalizeQueries({
    survivors: probe.survivors,
    dropped: probe.dropped,
    queryCount: QUERY_COUNT,
  });
  const finalizeMs = now() - finalizeStartMs;

  if (finalized.queries.length === 0) {
    logger.warn(
      { tickerId: input.tickerId, candidates: candidates.length },
      "query-analysis produced no surviving queries; skipping persist",
    );

    return {
      success: false,
      message: "No query survived the yield probe.",
      details: { created: 0 },
    };
  }

  const usageTotals = tokenUsage.totals();
  const providerUsage = probe.telemetry.providerUsage.map((entry) => ({
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
      searchCredits: probe.telemetry.searchCredits,
    },
    discovered: {
      competitors: competitors.map((entity) => entity.name),
      regulators: regulators.map((entity) => entity.name),
    },
    probe: {
      candidates: probe.telemetry.candidates,
      deduped: probe.telemetry.deduped,
      droppedZeroYield: probe.telemetry.dropped,
      survivors: probe.telemetry.survivors,
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
      probeMs,
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
