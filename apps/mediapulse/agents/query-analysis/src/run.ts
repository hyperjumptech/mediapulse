import { createAgentDataApiClient } from "@workspace/agent-data-api-client";
import type { GetQueryAnalysisResponse } from "@workspace/agent-data-api-contract";
import type { AgentRunContext, AgentRunResult } from "@workspace/agent-runtime";
import { computeLlmPromptFingerprint } from "@workspace/agent-llm-prompt-template";
import { logger } from "@workspace/logger";
import { env } from "@mediapulse/env/agents-query-analysis";
import type { QueryAnalysisConfig } from "./config-schema";
import {
  resolveDiversityGateConfig,
  resolveIntentWeights,
  resolveTemporalBiasConfig,
} from "./config-schema";
import {
  resolveQueryAnalysisSystemContent,
  resolveQueryAnalysisUserContent,
  fetchBrainstormBullets,
  fetchLlmQueryCandidatesByPersona,
  fetchWildcardCandidates,
  applySelfCritiquePass,
  DEFAULT_CRITIC_PASS_DEADLINE_MS,
  type LlmQueryStrategyPrompt,
} from "./llm-queries";
import type { LlmCandidate } from "./merge-query-candidates";
import {
  appendWildcardRowsToMerged,
  finalizeWildcardCandidates,
  mergeQueryCandidates,
  normalizeQueryKey,
} from "./merge-query-candidates";
import {
  buildQuerySemanticEmbedder,
  buildEmbeddingByText,
  collectQueryTextsForEmbedding,
  embedQueries,
} from "./embeddings";
import type { DeterministicCandidate, MergedQueryRow } from "./merge-query-candidates";
import { resolveQueryPersonas, filterPersonasForLanguage, type QueryPersona } from "./personas/default-personas";
import { buildDeterministicQueries } from "./templates/build-deterministic-queries";
import {
  distributeQueryCountAcrossLanguages,
  resolveLanguageQuotas,
  resolveLanguageTemplatePack,
  type DistributedLanguageQuota,
} from "./language-quotas";
import {
  buildDiversityBroadenSystemNudge,
  computeDiversityScore,
  type DiversityScoreResult,
  type DiversityScoreRow,
} from "./diversity/score";
import { DEFAULT_EVENT_BIAS_RULES } from "./temporal/default-rules";
import {
  applyEventBiasToIntentWeights,
  computeEventBias,
  type EventBiasResult,
} from "./temporal/event-bias";

export { buildDeterministicQueries } from "./templates/build-deterministic-queries";

export { DEFAULT_CRITIC_PASS_DEADLINE_MS } from "./llm-queries";

/**
 * Computes the reserved wildcard slot count from total set size and configured fraction.
 *
 * @param queryCount - Total rows to persist in the active query set.
 * @param wildcardFraction - Fraction of `queryCount` reserved for wildcard queries.
 * @returns Non-negative integer wildcard slot count.
 */
export const computeWildcardCount = (
  queryCount: number,
  wildcardFraction: number,
): number => Math.round(queryCount * wildcardFraction);

/**
 * Builds the sampling object shared by standard and wildcard LLM calls.
 *
 * @param config - Parsed invoke config with sampling fields.
 * @returns Sampling knobs for LLM calls.
 */
export const buildLlmSamplingFromConfig = (config: {
  temperature: number;
  topP: number;
  presencePenalty: number;
  frequencyPenalty: number;
  seed?: number;
}): {
  temperature: number;
  topP: number;
  presencePenalty: number;
  frequencyPenalty: number;
  seed?: number;
} => ({
  temperature: config.temperature,
  topP: config.topP,
  presencePenalty: config.presencePenalty,
  frequencyPenalty: config.frequencyPenalty,
  ...(config.seed !== undefined ? { seed: config.seed } : {}),
});

/**
 * Applies optional calendar-driven event bias to configured intent weights.
 *
 * @param baseIntentWeights - Weights from Hermes config after legacy lifting.
 * @param queryContext - Live GET /query-analysis payload.
 * @param temporalBias - Resolved temporal bias toggle.
 * @param deps - Injectable clock and rule library for tests.
 * @returns Adjusted weights plus snapshot metadata when rules fire.
 */
export const resolveIntentWeightsWithEventBias = (
  baseIntentWeights: ReturnType<typeof resolveIntentWeights>,
  queryContext: GetQueryAnalysisResponse,
  temporalBias: ReturnType<typeof resolveTemporalBiasConfig>,
  deps: {
    clock?: () => Date;
    rules?: typeof DEFAULT_EVENT_BIAS_RULES;
  } = {},
): {
  intentWeights: ReturnType<typeof resolveIntentWeights>;
  appliedEventBias?: EventBiasResult;
} => {
  if (!temporalBias.enabled) {
    return { intentWeights: baseIntentWeights };
  }

  const eventBias = computeEventBias(
    queryContext,
    deps.clock ?? (() => new Date()),
    deps.rules ?? DEFAULT_EVENT_BIAS_RULES,
  );

  if (eventBias.firedRuleIds.length === 0) {
    return { intentWeights: baseIntentWeights };
  }

  return {
    intentWeights: applyEventBiasToIntentWeights(
      baseIntentWeights,
      eventBias.multipliers,
    ),
    appliedEventBias: eventBias,
  };
};

type PersonaFetchParams = Parameters<
  typeof fetchLlmQueryCandidatesByPersona
>[0];
type PersonaFetchDeps = Parameters<typeof fetchLlmQueryCandidatesByPersona>[1];

/**
 * Maps LLM candidate rows to diversity score inputs.
 *
 * @param llmCandidates - Post-critique LLM batch.
 * @returns Rows for {@link computeDiversityScore}.
 */
export const toDiversityScoreRows = (
  llmCandidates: LlmCandidate[],
): DiversityScoreRow[] =>
  llmCandidates.map((candidate) => ({
    text: candidate.text,
    intent: candidate.intent,
    ...(candidate.persona !== undefined ? { persona: candidate.persona } : {}),
  }));

/**
 * Embeds LLM candidate texts for the semantic diversity axis (llm rows only).
 *
 * @param llmCandidates - Candidate batch to embed.
 * @param params - OpenAI credentials and embedding model.
 * @param deps - Injectable embed collaborator.
 * @returns Text-to-vector map when embedding succeeds; `undefined` on failure or empty input.
 */
export const buildLlmEmbeddingsForDiversity = async (
  llmCandidates: LlmCandidate[],
  params: { apiKey: string; embeddingModel: string; tickerId: string },
  deps: {
    embedQueries?: typeof embedQueries;
    logWarn?: (message: string, meta: Record<string, unknown>) => void;
  } = {},
): Promise<Map<string, number[]> | undefined> => {
  const runEmbed = deps.embedQueries ?? embedQueries;
  const warn =
    deps.logWarn ??
    ((message, meta) => {
      logger.warn(meta, message);
    });

  const texts = collectQueryTextsForEmbedding([], llmCandidates);
  if (texts.length < 2) {
    return undefined;
  }

  try {
    const embeddings = await runEmbed(texts, {
      apiKey: params.apiKey,
      model: params.embeddingModel,
    });
    return buildEmbeddingByText(texts, embeddings);
  } catch (error) {
    warn(
      "query-analysis diversity semantic embedding failed; omitting semantic axis",
      { error, tickerId: params.tickerId },
    );
    return undefined;
  }
};

/**
 * Runs at most one diversity-gate broaden regenerate pass when composite is below threshold.
 *
 * @param params - Current LLM batch, gate settings, optional embeddings, and broaden fetcher.
 * @returns Merged candidates, scores, and whether a regenerate pass ran.
 */
export const applyDiversityGatePass = async (params: {
  llmCandidates: LlmCandidate[];
  diversityGate: ReturnType<typeof resolveDiversityGateConfig>;
  embeddingsByText?: ReadonlyMap<string, number[]>;
  allowRegenerate?: boolean;
  fetchBroadenBatch: (broadenSystemNudge: string) => Promise<LlmCandidate[]>;
  logWarn?: (message: string, meta: Record<string, unknown>) => void;
}): Promise<{
  candidates: LlmCandidate[];
  diversityScore: DiversityScoreResult;
  diversityRegenerateFired: boolean;
}> => {
  const warn =
    params.logWarn ??
    ((message, meta) => {
      logger.warn(meta, message);
    });

  const scoreRows = toDiversityScoreRows(params.llmCandidates);
  const scoreBeforeGate = computeDiversityScore(scoreRows, {
    weights: params.diversityGate.weights,
    embeddingsByText: params.embeddingsByText,
  });

  if (
    !params.diversityGate.enabled ||
    scoreBeforeGate.composite >= params.diversityGate.threshold ||
    params.llmCandidates.length === 0 ||
    params.allowRegenerate === false
  ) {
    return {
      candidates: params.llmCandidates,
      diversityScore: scoreBeforeGate,
      diversityRegenerateFired: false,
    };
  }

  const broadenNudge = buildDiversityBroadenSystemNudge(scoreBeforeGate);
  let broadened: LlmCandidate[] = [];
  try {
    broadened = await params.fetchBroadenBatch(broadenNudge);
  } catch (error) {
    warn(
      "query-analysis diversity gate regenerate failed; shipping first batch",
      {
        error,
      },
    );
  }

  const mergedCandidates = [...params.llmCandidates, ...broadened];
  const diversityScore = computeDiversityScore(
    toDiversityScoreRows(mergedCandidates),
    {
      weights: params.diversityGate.weights,
      embeddingsByText: params.embeddingsByText,
    },
  );

  return {
    candidates: mergedCandidates,
    diversityScore,
    diversityRegenerateFired: true,
  };
};

type QueryAnalysisInput = { tickerId: string };

/**
 * Builds the semantic embedder for merge, falling back to string dedupe on API failure.
 *
 * @param params - OpenAI credentials, candidate rows, threshold, and logging context.
 * @param deps - Injectable embedding collaborator and logger.
 * @returns Embedder when embedding succeeds; `undefined` to fall back to string-key dedupe.
 */
export const buildSemanticEmbedderForMerge = async (
  params: {
    apiKey: string;
    deterministic: DeterministicCandidate[];
    llmCandidates: LlmCandidate[];
    threshold: number;
    embeddingModel: string;
    tickerId: string;
  },
  deps: {
    embedQueries?: typeof embedQueries;
    logWarn?: (message: string, meta: Record<string, unknown>) => void;
  } = {},
): Promise<ReturnType<typeof buildQuerySemanticEmbedder> | undefined> => {
  const runEmbed = deps.embedQueries ?? embedQueries;
  const warn =
    deps.logWarn ??
    ((message, meta) => {
      logger.warn(meta, message);
    });

  const texts = collectQueryTextsForEmbedding(
    params.deterministic,
    params.llmCandidates,
  );
  if (texts.length === 0) {
    return undefined;
  }

  try {
    const embeddings = await runEmbed(texts, {
      apiKey: params.apiKey,
      model: params.embeddingModel,
    });
    return buildQuerySemanticEmbedder(texts, embeddings, params.threshold);
  } catch (error) {
    warn(
      "query-analysis semantic dedupe embedding failed; falling back to string-key dedupe",
      { error, tickerId: params.tickerId },
    );
    return undefined;
  }
};

/**
 * Clamps per-persona quota when fan-out would exceed three times the target set size.
 *
 * @param personasLength - Number of personas that will run in parallel.
 * @param perPersonaQuotaCount - Configured quota per persona.
 * @param queryCount - Total rows to persist in the active query set.
 * @returns Effective per-persona quota (≥ 1 when personasLength > 0).
 */
export const clampPerPersonaQuotaCount = (
  personasLength: number,
  perPersonaQuotaCount: number,
  queryCount: number,
): number => {
  if (personasLength <= 0) {
    return perPersonaQuotaCount;
  }
  const maxTotal = queryCount * 3;
  const product = personasLength * perPersonaQuotaCount;
  if (product <= maxTotal) {
    return perPersonaQuotaCount;
  }
  return Math.max(1, Math.floor(maxTotal / personasLength));
};

/** Shared LLM configuration passed into each language slice. */
type LanguageSliceSharedConfig = {
  openaiApiKey: string;
  openaiModel: string;
  maxTokens: number;
  globalTemplatePack: string;
  kgTemplateCap: number;
  intentWeights: LlmQueryStrategyPrompt["intentWeights"];
  llmSampling: ReturnType<typeof buildLlmSamplingFromConfig>;
  useBrainstormPass: boolean;
  brainstormModel: string;
  fewShotExemplarCount: number;
  useSelfCritique: boolean;
  critiqueDropFraction: number;
  critiqueModel: string;
  perPersonaQuotaCount: number;
  diversityGate: ReturnType<typeof resolveDiversityGateConfig>;
  semanticDedupeEnabled: boolean;
  embeddingModel: string;
  configuredSystemPrompt?: string;
  configuredUserPromptTemplate?: string;
  runStartMs: number;
  tickerId: string;
};

/**
 * Generates and merges deterministic + LLM candidates for one language quota slice.
 *
 * @param params - Language quota row, context, personas, and shared run config.
 * @returns Merged rows for the slice plus observability counters.
 */
export const runLanguageQuerySlice = async (params: {
  languageQuota: DistributedLanguageQuota;
  minDeterministicCount: number;
  queryContext: GetQueryAnalysisResponse;
  personas: QueryPersona[];
  shared: LanguageSliceSharedConfig;
}): Promise<{
  merged: MergedQueryRow[];
  diversityScore?: DiversityScoreResult;
  diversityRegenerateFired: boolean;
  selfCritiqueReplacedCount: number;
  selfCritiqueSkippedDueToDeadline: boolean;
}> => {
  const { languageQuota, shared } = params;
  const language = languageQuota.language;
  const langPersonas = filterPersonasForLanguage(params.personas, language);
  const templatePack = resolveLanguageTemplatePack(
    language,
    languageQuota.templatePack,
    shared.globalTemplatePack,
  );

  const deterministic = buildDeterministicQueries(params.queryContext, {
    pack: templatePack,
    kgTemplateCap: shared.kgTemplateCap,
    language,
  });

  const strategyPrompt: LlmQueryStrategyPrompt = {
    queryCount: languageQuota.queryCount,
    language,
    minDeterministicCount: params.minDeterministicCount,
    intentWeights: shared.intentWeights,
  };

  const systemContent = resolveQueryAnalysisSystemContent(
    shared.configuredSystemPrompt,
    strategyPrompt,
  );
  const userContent = resolveQueryAnalysisUserContent(
    shared.configuredUserPromptTemplate,
    params.queryContext,
    language,
  );

  let llmCandidates: LlmCandidate[] = [];
  let brainstormBullets: string[] | undefined;
  try {
    if (shared.useBrainstormPass) {
      brainstormBullets = await fetchBrainstormBullets({
        apiKey: shared.openaiApiKey,
        model: shared.brainstormModel,
        maxOutputTokens: shared.maxTokens,
        strategy: strategyPrompt,
        context: params.queryContext,
        sampling: shared.llmSampling,
      });
    }

    if (langPersonas.length > 0) {
      const rows = await fetchLlmQueryCandidatesByPersona(
        {
          apiKey: shared.openaiApiKey,
          model: shared.openaiModel,
          maxOutputTokens: shared.maxTokens,
          systemContent,
          userContent,
          personas: langPersonas,
          perPersonaQuota: shared.perPersonaQuotaCount,
          fewShotExemplarCount: shared.fewShotExemplarCount,
          brainstormBullets,
          sampling: shared.llmSampling,
        },
        {
          warn: (_message, meta) => {
            logger.warn(
              {
                error: meta.error,
                personaId: meta.personaId,
                tickerId: shared.tickerId,
                language,
              },
              "query-analysis persona LLM call failed; skipping persona",
            );
          },
        },
      );
      llmCandidates = rows.map((row) => ({ ...row, language }));
    }
  } catch (error) {
    logger.warn(
      { error, tickerId: shared.tickerId, language },
      "query-analysis LLM failed for language slice; using deterministic only",
    );
  }

  let selfCritiqueReplacedCount = 0;
  let selfCritiqueSkippedDueToDeadline = false;
  if (shared.useSelfCritique && llmCandidates.length > 0) {
    if (Date.now() - shared.runStartMs > DEFAULT_CRITIC_PASS_DEADLINE_MS) {
      selfCritiqueSkippedDueToDeadline = true;
    } else {
      try {
        const critiqueResult = await applySelfCritiquePass({
          apiKey: shared.openaiApiKey,
          critiqueModel: shared.critiqueModel,
          generationModel: shared.openaiModel,
          maxOutputTokens: shared.maxTokens,
          systemContent,
          userContent,
          context: params.queryContext,
          candidates: llmCandidates,
          dropFraction: shared.critiqueDropFraction,
          fewShotExemplarCount: shared.fewShotExemplarCount,
          sampling: shared.llmSampling,
          runStartMs: shared.runStartMs,
          deadlineMs: DEFAULT_CRITIC_PASS_DEADLINE_MS,
        });
        llmCandidates = critiqueResult.candidates.map((row) => ({
          ...row,
          language,
        }));
        selfCritiqueReplacedCount = critiqueResult.replacedCount;
        selfCritiqueSkippedDueToDeadline = critiqueResult.skippedDueToDeadline;
      } catch (error) {
        logger.warn(
          { error, tickerId: shared.tickerId, language },
          "query-analysis self-critique failed for language slice",
        );
      }
    }
  }

  const diversityGate = shared.diversityGate;
  let diversityEmbeddingsByText: Map<string, number[]> | undefined;
  if (shared.semanticDedupeEnabled && llmCandidates.length >= 2) {
    diversityEmbeddingsByText = await buildLlmEmbeddingsForDiversity(
      llmCandidates,
      {
        apiKey: shared.openaiApiKey,
        embeddingModel: shared.embeddingModel,
        tickerId: shared.tickerId,
      },
    );
  }

  let diversityScore: DiversityScoreResult | undefined;
  let diversityRegenerateFired = false;
  if (llmCandidates.length > 0) {
    const gateResult = await applyDiversityGatePass({
      llmCandidates,
      diversityGate,
      embeddingsByText: diversityEmbeddingsByText,
      allowRegenerate: langPersonas.length > 0,
      fetchBroadenBatch: (broadenSystemNudge) =>
        fetchLlmQueryCandidatesByPersona(
          {
            apiKey: shared.openaiApiKey,
            model: shared.openaiModel,
            maxOutputTokens: shared.maxTokens,
            systemContent,
            userContent,
            personas: langPersonas,
            perPersonaQuota: shared.perPersonaQuotaCount,
            fewShotExemplarCount: shared.fewShotExemplarCount,
            brainstormBullets,
            sampling: shared.llmSampling,
            broadenSystemNudge,
          },
          {
            warn: (_message, meta) => {
              logger.warn(
                {
                  error: meta.error,
                  personaId: meta.personaId,
                  tickerId: shared.tickerId,
                  language,
                },
                "query-analysis persona LLM call failed; skipping persona",
              );
            },
          },
        ).then((rows) => rows.map((row) => ({ ...row, language }))),
      logWarn: (message, meta) => {
        logger.warn({ ...meta, tickerId: shared.tickerId, language }, message);
      },
    });
    llmCandidates = gateResult.candidates.map((row) => ({ ...row, language }));
    diversityScore = gateResult.diversityScore;
    diversityRegenerateFired = gateResult.diversityRegenerateFired;

    if (diversityRegenerateFired && shared.semanticDedupeEnabled) {
      diversityEmbeddingsByText = await buildLlmEmbeddingsForDiversity(
        llmCandidates,
        {
          apiKey: shared.openaiApiKey,
          embeddingModel: shared.embeddingModel,
          tickerId: shared.tickerId,
        },
      );
      diversityScore = computeDiversityScore(
        toDiversityScoreRows(llmCandidates),
        {
          weights: diversityGate.weights,
          embeddingsByText: diversityEmbeddingsByText,
        },
      );
    }
  }

  const merged = mergeQueryCandidates({
    deterministic,
    llm: llmCandidates,
    queryCount: languageQuota.queryCount,
    minDeterministicCount: params.minDeterministicCount,
    weights: shared.intentWeights,
  });

  return {
    merged,
    diversityScore,
    diversityRegenerateFired,
    selfCritiqueReplacedCount,
    selfCritiqueSkippedDueToDeadline,
  };
};

/**
 * Concatenates per-language merged rows and reassigns contiguous ranks.
 *
 * @param slices - Ordered language slice merge results.
 * @returns Flattened rows with ranks 1..N.
 */
export const concatenateLanguageMergedRows = (
  slices: MergedQueryRow[][],
): MergedQueryRow[] => {
  const combined = slices.flat();
  return combined.map((row, index) => ({ ...row, rank: index + 1 }));
};

/**
 * Runs the query-analysis agent for one ticker and persists an active query set.
 *
 * @param context - Agent run context with validated input/config and bearer token.
 * @returns Success response with created query count.
 */
export const runQueryAnalysis = async (
  context: AgentRunContext<QueryAnalysisInput, QueryAnalysisConfig>,
): Promise<AgentRunResult> => {
  const { input, config, token, hermesCorrelation } = context;
  const runStartMs = Date.now();
  const client = createAgentDataApiClient({
    baseUrl: env.AGENT_DATA_API_URL,
    version: "v1",
    token,
  });

  const queryContext = await client.queryAnalysis.get({
    tickerId: input.tickerId,
  });
  const templatePack = config.templatePack!;
  const kgTemplateCap = config.kgTemplateCap!;

  // Zod applies defaults in `createAgentApp` before calling `run`.
  const queryCount = config.queryCount!;
  const wildcardFraction = config.wildcardFraction!;
  const wildcardTemperature = config.wildcardTemperature!;
  const wildcardCount = computeWildcardCount(queryCount, wildcardFraction);
  const standardQueryCount = queryCount - wildcardCount;
  const languageQuotas = resolveLanguageQuotas(config);
  const minDeterministicCount = config.minDeterministicCount!;
  const baseIntentWeights = resolveIntentWeights(config);
  const temporalBias = resolveTemporalBiasConfig(config);
  const { intentWeights, appliedEventBias } = resolveIntentWeightsWithEventBias(
    baseIntentWeights,
    queryContext,
    temporalBias,
  );
  if (appliedEventBias !== undefined) {
    logger.info(
      {
        tickerId: input.tickerId,
        firedRuleIds: appliedEventBias.firedRuleIds,
        multipliers: appliedEventBias.multipliers,
      },
      "query-analysis temporal event bias applied",
    );
  }
  const openaiModel = config.openaiModel!;
  const maxTokens = config.maxTokens!;
  const temperature = config.temperature!;
  const topP = config.topP!;
  const presencePenalty = config.presencePenalty!;
  const frequencyPenalty = config.frequencyPenalty!;
  const seed = config.seed;
  const useBrainstormPass = config.useBrainstormPass!;
  const fewShotExemplarCount = config.fewShotExemplarCount!;
  const brainstormModel = config.brainstormModel ?? openaiModel;
  const useSelfCritique = config.useSelfCritique!;
  const critiqueDropFraction = config.critiqueDropFraction!;
  const critiqueModel = config.critiqueModel ?? openaiModel;
  const personaIds = config.personas!;
  let perPersonaQuotaCount = config.perPersonaQuotaCount!;
  const resolvedPersonas = resolveQueryPersonas(personaIds, {
    warn: (_message, meta) => {
      logger.warn(
        { unknownPersonaId: meta.unknownId, tickerId: input.tickerId },
        "unknown query-analysis persona id; skipping",
      );
    },
  });

  const languageCount = languageQuotas.length;
  const personaCellCount = resolvedPersonas.length * languageCount;
  if (personaCellCount > 0 && personaCellCount * perPersonaQuotaCount > standardQueryCount * 3) {
    const clamped = clampPerPersonaQuotaCount(
      personaCellCount,
      perPersonaQuotaCount,
      standardQueryCount,
    );
    logger.warn(
      {
        tickerId: input.tickerId,
        personas: resolvedPersonas.length,
        languages: languageCount,
        configuredPerPersonaQuotaCount: perPersonaQuotaCount,
        clampedPerPersonaQuotaCount: clamped,
        queryCount: standardQueryCount,
      },
      "query-analysis persona × language fan-out exceeds cost guard; clamping perPersonaQuotaCount",
    );
    perPersonaQuotaCount = clamped;
  }

  const distributedStandard = distributeQueryCountAcrossLanguages(
    standardQueryCount,
    languageQuotas,
  );
  const distributedMinDeterministic = distributeQueryCountAcrossLanguages(
    minDeterministicCount,
    languageQuotas,
  );

  const llmSampling = buildLlmSamplingFromConfig({
    temperature,
    topP,
    presencePenalty,
    frequencyPenalty,
    ...(seed !== undefined ? { seed } : {}),
  });

  const diversityGate = resolveDiversityGateConfig(config);
  const semanticDedupeConfig = config.semanticDedupe;
  const embeddingModel =
    semanticDedupeConfig?.embeddingModel ?? "text-embedding-3-small";

  const primaryLanguage = languageQuotas[0]?.language ?? "en";
  const llmPromptFingerprint = computeLlmPromptFingerprint(
    resolveQueryAnalysisSystemContent(config.prompts?.systemPrompt, {
      queryCount: standardQueryCount,
      language: primaryLanguage,
      minDeterministicCount,
      intentWeights,
    }),
    resolveQueryAnalysisUserContent(
      config.prompts?.userPromptTemplate,
      queryContext,
      primaryLanguage,
    ),
  );

  const sharedSliceConfig: LanguageSliceSharedConfig = {
    openaiApiKey: config.openaiApiKey,
    openaiModel,
    maxTokens,
    globalTemplatePack: templatePack,
    kgTemplateCap,
    intentWeights,
    llmSampling,
    useBrainstormPass,
    brainstormModel,
    fewShotExemplarCount,
    useSelfCritique,
    critiqueDropFraction,
    critiqueModel,
    perPersonaQuotaCount,
    diversityGate,
    semanticDedupeEnabled: semanticDedupeConfig?.enabled ?? false,
    embeddingModel,
    configuredSystemPrompt: config.prompts?.systemPrompt,
    configuredUserPromptTemplate: config.prompts?.userPromptTemplate,
    runStartMs,
    tickerId: input.tickerId,
  };

  const sliceResults = await Promise.all(
    distributedStandard.map((languageQuota) => {
      const minDet =
        distributedMinDeterministic.find(
          (row) => row.language === languageQuota.language,
        )?.queryCount ?? 0;
      return runLanguageQuerySlice({
        languageQuota,
        minDeterministicCount: minDet,
        queryContext,
        personas: resolvedPersonas,
        shared: sharedSliceConfig,
      });
    }),
  );

  let selfCritiqueReplacedCount = 0;
  let selfCritiqueSkippedDueToDeadline = false;
  let diversityRegenerateFired = false;
  let diversityScore: DiversityScoreResult | undefined;
  for (const slice of sliceResults) {
    selfCritiqueReplacedCount += slice.selfCritiqueReplacedCount;
    selfCritiqueSkippedDueToDeadline =
      selfCritiqueSkippedDueToDeadline || slice.selfCritiqueSkippedDueToDeadline;
    diversityRegenerateFired =
      diversityRegenerateFired || slice.diversityRegenerateFired;
    if (slice.diversityScore !== undefined) {
      diversityScore = slice.diversityScore;
    }
  }

  if (diversityScore !== undefined) {
    logger.info(
      {
        tickerId: input.tickerId,
        diversityScore,
        diversityRegenerateFired,
        diversityGateEnabled: diversityGate.enabled,
      },
      "query-analysis diversity score computed",
    );
  }

  const mergedStandard = concatenateLanguageMergedRows(
    sliceResults.map((slice) => slice.merged),
  );

  const wildcardLanguages = languageQuotas.map((quota) => quota.language);

  let merged = mergedStandard;
  if (wildcardCount > 0) {
    const seenKeys = new Set(
      mergedStandard.map((row) => normalizeQueryKey(row.text)),
    );
    let wildcardBatch: LlmCandidate[] = [];
    try {
      wildcardBatch = await fetchWildcardCandidates({
        apiKey: config.openaiApiKey,
        model: openaiModel,
        maxOutputTokens: maxTokens,
        count: wildcardCount,
        context: queryContext,
        allowedLanguages: wildcardLanguages,
        sampling: llmSampling,
        wildcardTemperature,
      });
    } catch (error) {
      logger.warn(
        { error, tickerId: input.tickerId, wildcardCount },
        "query-analysis wildcard LLM failed; shipping standard set only",
      );
    }

    const wildcardRows = await finalizeWildcardCandidates({
      wildcards: wildcardBatch,
      seenKeys,
      wildcardCount,
      retryFetch:
        wildcardCount > 0
          ? async (avoidTexts) => {
              try {
                return await fetchWildcardCandidates({
                  apiKey: config.openaiApiKey,
                  model: openaiModel,
                  maxOutputTokens: maxTokens,
                  count: wildcardCount,
                  context: queryContext,
                  allowedLanguages: wildcardLanguages,
                  sampling: llmSampling,
                  wildcardTemperature,
                  avoidTexts,
                });
              } catch (error) {
                logger.warn(
                  { error, tickerId: input.tickerId, wildcardCount },
                  "query-analysis wildcard retry failed; keeping accepted wildcard rows",
                );
                return [];
              }
            }
          : undefined,
    });
    merged = appendWildcardRowsToMerged(
      mergedStandard,
      wildcardRows,
      queryCount,
    );
  }

  const strategySnapshot = {
    queryCount,
    wildcardFraction,
    wildcardTemperature,
    wildcardCount,
    kgTemplateCap,
    languageQuotas,
    minDeterministicCount,
    intentWeights,
    ...(appliedEventBias !== undefined
      ? {
          appliedEventBias: {
            firedRuleIds: appliedEventBias.firedRuleIds,
            multipliers: appliedEventBias.multipliers,
          },
        }
      : {}),
    model: openaiModel,
    maxTokens,
    temperature,
    topP,
    presencePenalty,
    frequencyPenalty,
    useBrainstormPass,
    fewShotExemplarCount,
    personas: personaIds,
    perPersonaQuotaCount,
    useSelfCritique,
    ...(useSelfCritique
      ? {
          critiqueDropFraction,
          critiqueModel,
          selfCritiqueReplacedCount,
          selfCritiqueSkippedDueToDeadline,
        }
      : {}),
    ...(useBrainstormPass ? { brainstormModel } : {}),
    ...(seed !== undefined ? { seed } : {}),
    ...(semanticDedupeConfig?.enabled
      ? {
          semanticDedupe: {
            enabled: true,
            threshold: semanticDedupeConfig.threshold ?? 0.85,
            embeddingModel,
          },
        }
      : {}),
    ...(diversityScore !== undefined
      ? {
          diversityScore,
          ...(diversityGate.enabled
            ? {
                diversityGate: {
                  enabled: true,
                  threshold: diversityGate.threshold,
                  weights: diversityGate.weights,
                  diversityRegenerateFired,
                },
              }
            : {}),
        }
      : {}),
  };

  const response = await client.queryAnalysis.create({
    tickerId: input.tickerId,
    generationSource: "hybrid_v1",
    strategySnapshot,
    activate: true,
    queries: merged.map(({ text, source, intent, rank }) => ({
      text,
      source,
      intent,
      rank,
    })),
    ...(hermesCorrelation?.jobId !== undefined
      ? { agentJobId: hermesCorrelation.jobId }
      : {}),
  });

  logger.info(
    { tickerId: input.tickerId, created: response.created },
    "query analysis set persisted",
  );
  return {
    success: true,
    details: { ...response, llmPromptFingerprint },
  };
};
