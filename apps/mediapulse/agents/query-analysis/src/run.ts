import { createAgentDataApiClient } from "@workspace/agent-data-api-client";
import type { AgentRunContext, AgentRunResult } from "@workspace/agent-runtime";
import { computeLlmPromptFingerprint } from "@workspace/agent-llm-prompt-template";
import { logger } from "@workspace/logger";
import { env } from "@mediapulse/env/agents-query-analysis";
import type { QueryAnalysisConfig } from "./config-schema";
import {
  resolveDiversityGateConfig,
  resolveIntentWeights,
} from "./config-schema";
import {
  resolveQueryAnalysisSystemContent,
  resolveQueryAnalysisUserContent,
  fetchBrainstormBullets,
  fetchLlmQueryCandidatesByPersona,
  applySelfCritiquePass,
  DEFAULT_CRITIC_PASS_DEADLINE_MS,
} from "./llm-queries";
import type { LlmCandidate } from "./merge-query-candidates";
import { mergeQueryCandidates } from "./merge-query-candidates";
import {
  buildQuerySemanticEmbedder,
  buildEmbeddingByText,
  collectQueryTextsForEmbedding,
  embedQueries,
} from "./embeddings";
import type { DeterministicCandidate } from "./merge-query-candidates";
import { resolveQueryPersonas } from "./personas/default-personas";
import { buildDeterministicQueries } from "./templates/build-deterministic-queries";
import {
  buildDiversityBroadenSystemNudge,
  computeDiversityScore,
  type DiversityScoreResult,
  type DiversityScoreRow,
} from "./diversity/score";

export { buildDeterministicQueries } from "./templates/build-deterministic-queries";

export { DEFAULT_CRITIC_PASS_DEADLINE_MS } from "./llm-queries";

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

  const deterministic = buildDeterministicQueries(queryContext, {
    pack: templatePack,
  });

  // Zod applies defaults in `createAgentApp` before calling `run`.
  const queryCount = config.queryCount!;
  const allowedLanguages = config.allowedLanguages!;
  const minDeterministicCount = config.minDeterministicCount!;
  const intentWeights = resolveIntentWeights(config);
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

  if (
    resolvedPersonas.length > 0 &&
    resolvedPersonas.length * perPersonaQuotaCount > queryCount * 3
  ) {
    const clamped = clampPerPersonaQuotaCount(
      resolvedPersonas.length,
      perPersonaQuotaCount,
      queryCount,
    );
    logger.warn(
      {
        tickerId: input.tickerId,
        personas: resolvedPersonas.length,
        configuredPerPersonaQuotaCount: perPersonaQuotaCount,
        clampedPerPersonaQuotaCount: clamped,
        queryCount,
      },
      "query-analysis persona fan-out exceeds cost guard; clamping perPersonaQuotaCount",
    );
    perPersonaQuotaCount = clamped;
  }

  const strategyPrompt = {
    queryCount,
    allowedLanguages,
    minDeterministicCount,
    intentWeights,
  };

  const systemContent = resolveQueryAnalysisSystemContent(
    config.prompts?.systemPrompt,
    strategyPrompt,
  );
  const userContent = resolveQueryAnalysisUserContent(
    config.prompts?.userPromptTemplate,
    queryContext,
  );

  const llmPromptFingerprint = computeLlmPromptFingerprint(
    systemContent,
    userContent,
  );

  let llmCandidates: LlmCandidate[] = [];
  let brainstormBullets: string[] | undefined;
  try {
    if (useBrainstormPass) {
      brainstormBullets = await fetchBrainstormBullets({
        apiKey: config.openaiApiKey,
        model: brainstormModel,
        maxOutputTokens: maxTokens,
        strategy: strategyPrompt,
        context: queryContext,
        sampling: {
          temperature,
          topP,
          presencePenalty,
          frequencyPenalty,
          ...(seed !== undefined ? { seed } : {}),
        },
      });
    }

    if (resolvedPersonas.length > 0) {
      llmCandidates = await fetchLlmQueryCandidatesByPersona(
        {
          apiKey: config.openaiApiKey,
          model: openaiModel,
          maxOutputTokens: maxTokens,
          systemContent,
          userContent,
          personas: resolvedPersonas,
          perPersonaQuota: perPersonaQuotaCount,
          fewShotExemplarCount,
          brainstormBullets,
          sampling: {
            temperature,
            topP,
            presencePenalty,
            frequencyPenalty,
            ...(seed !== undefined ? { seed } : {}),
          },
        },
        {
          warn: (_message, meta) => {
            logger.warn(
              {
                error: meta.error,
                personaId: meta.personaId,
                tickerId: input.tickerId,
              },
              "query-analysis persona LLM call failed; skipping persona",
            );
          },
        },
      );
    }
  } catch (error) {
    logger.warn(
      { error, tickerId: input.tickerId },
      "query-analysis LLM failed; using deterministic candidates only",
    );
  }

  let selfCritiqueReplacedCount = 0;
  let selfCritiqueSkippedDueToDeadline = false;
  if (useSelfCritique && llmCandidates.length > 0) {
    if (Date.now() - runStartMs > DEFAULT_CRITIC_PASS_DEADLINE_MS) {
      selfCritiqueSkippedDueToDeadline = true;
      logger.warn(
        {
          tickerId: input.tickerId,
          elapsedMs: Date.now() - runStartMs,
          deadlineMs: DEFAULT_CRITIC_PASS_DEADLINE_MS,
        },
        "query-analysis self-critique skipped due to deadline; shipping original LLM candidates",
      );
    } else {
      try {
        const critiqueResult = await applySelfCritiquePass({
          apiKey: config.openaiApiKey,
          critiqueModel,
          generationModel: openaiModel,
          maxOutputTokens: maxTokens,
          systemContent,
          userContent,
          context: queryContext,
          candidates: llmCandidates,
          dropFraction: critiqueDropFraction,
          fewShotExemplarCount,
          sampling: {
            temperature,
            topP,
            presencePenalty,
            frequencyPenalty,
            ...(seed !== undefined ? { seed } : {}),
          },
          runStartMs,
          deadlineMs: DEFAULT_CRITIC_PASS_DEADLINE_MS,
        });
        llmCandidates = critiqueResult.candidates;
        selfCritiqueReplacedCount = critiqueResult.replacedCount;
        selfCritiqueSkippedDueToDeadline = critiqueResult.skippedDueToDeadline;
        if (critiqueResult.skippedDueToDeadline) {
          logger.warn(
            { tickerId: input.tickerId },
            "query-analysis self-critique aborted mid-pass due to deadline",
          );
        }
      } catch (error) {
        logger.warn(
          { error, tickerId: input.tickerId },
          "query-analysis self-critique failed; using pre-critique LLM candidates",
        );
      }
    }
  }

  const diversityGate = resolveDiversityGateConfig(config);
  const semanticDedupeConfig = config.semanticDedupe;
  const embeddingModel =
    semanticDedupeConfig?.embeddingModel ?? "text-embedding-3-small";

  const personaFetchSampling = {
    temperature,
    topP,
    presencePenalty,
    frequencyPenalty,
    ...(seed !== undefined ? { seed } : {}),
  };
  const personaFetchDeps: PersonaFetchDeps = {
    warn: (_message, meta) => {
      logger.warn(
        {
          error: meta.error,
          personaId: meta.personaId,
          tickerId: input.tickerId,
        },
        "query-analysis persona LLM call failed; skipping persona",
      );
    },
  };
  const buildPersonaFetchParams = (
    broadenSystemNudge?: string,
  ): PersonaFetchParams => ({
    apiKey: config.openaiApiKey,
    model: openaiModel,
    maxOutputTokens: maxTokens,
    systemContent,
    userContent,
    personas: resolvedPersonas,
    perPersonaQuota: perPersonaQuotaCount,
    fewShotExemplarCount,
    brainstormBullets,
    sampling: personaFetchSampling,
    ...(broadenSystemNudge !== undefined ? { broadenSystemNudge } : {}),
  });

  let diversityEmbeddingsByText: Map<string, number[]> | undefined;
  if (semanticDedupeConfig?.enabled && llmCandidates.length >= 2) {
    diversityEmbeddingsByText = await buildLlmEmbeddingsForDiversity(
      llmCandidates,
      {
        apiKey: config.openaiApiKey,
        embeddingModel,
        tickerId: input.tickerId,
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
      allowRegenerate: resolvedPersonas.length > 0,
      fetchBroadenBatch: (broadenSystemNudge) =>
        fetchLlmQueryCandidatesByPersona(
          buildPersonaFetchParams(broadenSystemNudge),
          personaFetchDeps,
        ),
      logWarn: (message, meta) => {
        logger.warn({ ...meta, tickerId: input.tickerId }, message);
      },
    });
    llmCandidates = gateResult.candidates;
    diversityScore = gateResult.diversityScore;
    diversityRegenerateFired = gateResult.diversityRegenerateFired;

    if (diversityRegenerateFired && semanticDedupeConfig?.enabled) {
      diversityEmbeddingsByText = await buildLlmEmbeddingsForDiversity(
        llmCandidates,
        {
          apiKey: config.openaiApiKey,
          embeddingModel,
          tickerId: input.tickerId,
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

  let semanticEmbedder: Awaited<
    ReturnType<typeof buildSemanticEmbedderForMerge>
  > = undefined;
  if (semanticDedupeConfig?.enabled) {
    semanticEmbedder = await buildSemanticEmbedderForMerge({
      apiKey: config.openaiApiKey,
      deterministic,
      llmCandidates,
      threshold: semanticDedupeConfig.threshold ?? 0.85,
      embeddingModel,
      tickerId: input.tickerId,
    });
  }

  const merged = mergeQueryCandidates({
    deterministic,
    llm: llmCandidates,
    queryCount,
    minDeterministicCount,
    weights: intentWeights,
    ...(semanticEmbedder ? { embedder: semanticEmbedder } : {}),
  });

  const strategySnapshot = {
    queryCount,
    allowedLanguages,
    minDeterministicCount,
    intentWeights,
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
