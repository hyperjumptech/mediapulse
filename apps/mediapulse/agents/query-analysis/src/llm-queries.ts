import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import type { ModelMessage } from "ai";
import {
  QUERY_ANALYSIS_STANDARD_INTENTS,
  SECTION_BY_INTENT,
  queryAnalysisIntentSchema,
  type GetQueryAnalysisResponse,
  type QueryAnalysisIntent,
  type QueryAnalysisIntentWeights,
} from "@workspace/agent-data-api-contract";
import {
  applyContractBrief,
  extractLlmUsage,
  type OnLlmUsage,
} from "@workspace/agent-runtime";
import { z } from "zod";

import {
  formatExemplarAssistantContent,
  selectFewShotExemplars,
} from "./exemplars/default-exemplars";
import type { QueryPersona } from "./personas/default-personas";
import type { LlmCandidate } from "./merge-query-candidates";
import { normalizeQueryKey } from "./merge-query-candidates";
import { resolveEntityDisplayName } from "./i18n/entity-aliases";

/** Zod schema for structured LLM output (validated by AI SDK). */
export const llmQueriesOutputSchema = z.object({
  queries: z.array(
    z.object({
      text: z.string(),
      intent: queryAnalysisIntentSchema,
    }),
  ),
});

/** Zod schema for structured wildcard LLM output (no intent field). */
export const llmWildcardOutputSchema = z.object({
  queries: z.array(
    z.object({
      text: z.string(),
    }),
  ),
});

/** Zod schema for the self-critique structured-output pass. */
export const llmCritiqueOutputSchema = z.object({
  ratings: z.array(
    z.object({
      text: z.string(),
      relevance: z.number().min(1).max(5),
      novelty: z.number().min(1).max(5),
      drop: z.boolean(),
    }),
  ),
});

export type CritiqueRating = z.infer<
  typeof llmCritiqueOutputSchema
>["ratings"][number];

// Chronicle instrumentation: token usage helpers live in @workspace/agent-runtime
// so every agent accumulates the same way. Re-exported here for local call sites
// (and the existing tests) that reference them from this module.
export { extractLlmUsage, type OnLlmUsage };

export type LlmQueryStrategyPrompt = {
  queryCount: number;
  /** Single target language for this generation pass (BCP-47). */
  language: string;
  /** @deprecated Legacy list placeholder for Hermes custom templates. */
  allowedLanguages?: string[];
  minDeterministicCount: number;
  intentWeights: QueryAnalysisIntentWeights;
  /** Maximum words per generated keyword phrase. Defaults to 5 when omitted. */
  queryMaxWords?: number;
  /** When true, reserves intent budget per newsletter section and injects keyword guidance for starved sections. */
  sectionCoverageEnabled?: boolean;
  /** Opaque product brief from the Agent Contract; appended to the system prompt when present. */
  brief?: string;
};

const QUERY_ANALYSIS_INTENT_JSON_UNION = QUERY_ANALYSIS_STANDARD_INTENTS.map(
  (intent) => `"${intent}"`,
).join(" | ");

/**
 * Computes approximate LLM target counts per standard intent from strategy weights.
 *
 * When `sectionCoverageEnabled` is true, intents that map to a newsletter section via
 * {@link SECTION_BY_INTENT} are guaranteed at least 1 query, so every section with a
 * dedicated intent has upstream search budget.
 *
 * @param strategy - Query budget and relative intent weights for the language slice.
 * @returns Rounded target count per standard intent label.
 */
export const computeQueryAnalysisIntentTargetCounts = (
  strategy: Pick<
    LlmQueryStrategyPrompt,
    "queryCount" | "intentWeights" | "sectionCoverageEnabled"
  >,
): Record<(typeof QUERY_ANALYSIS_STANDARD_INTENTS)[number], number> => {
  const sum = QUERY_ANALYSIS_STANDARD_INTENTS.reduce(
    (total, intent) => total + strategy.intentWeights[intent],
    0,
  );
  const counts = {} as Record<
    (typeof QUERY_ANALYSIS_STANDARD_INTENTS)[number],
    number
  >;
  for (const intent of QUERY_ANALYSIS_STANDARD_INTENTS) {
    const ratio =
      sum > 0
        ? strategy.intentWeights[intent] / sum
        : 1 / QUERY_ANALYSIS_STANDARD_INTENTS.length;
    counts[intent] = Math.round(ratio * strategy.queryCount);
  }
  if (strategy.sectionCoverageEnabled) {
    for (const intent of QUERY_ANALYSIS_STANDARD_INTENTS) {
      if (SECTION_BY_INTENT[intent] !== null && counts[intent] < 1) {
        counts[intent] = 1;
      }
    }
  }
  return counts;
};

/**
 * Builds the query-analysis system prompt with inline strategy interpolation.
 *
 * When `strategy.sectionCoverageEnabled` is true, appends explicit keyword guidance
 * for newsletter sections that have no dedicated intent (e.g. Deals & Movements).
 *
 * When `strategy.brief` is set, the opaque product contract brief is appended via
 * {@link applyContractBrief} so the LLM knows the end artifact it is feeding.
 *
 * @param strategy - Strategy knobs for language lock, intent targets, deterministic floor, and optional contract brief.
 * @returns System message content for the chat model.
 */
export const buildQueryAnalysisSystemContent = (
  strategy: LlmQueryStrategyPrompt,
): string => {
  const targets = computeQueryAnalysisIntentTargetCounts(strategy);
  const intentTargetLines = QUERY_ANALYSIS_STANDARD_INTENTS.map(
    (intent) => `- ${intent}: ${String(targets[intent])}`,
  ).join("\n");
  const maxWords = strategy.queryMaxWords ?? 5;
  const phraseLengthHint =
    maxWords === 5
      ? "Keep each query to about 2–5 words."
      : `Keep each query to about ${String(maxWords)} words.`;

  const sections: string[] = [
    "You generate short keyword search queries for news monitoring.",
    `Return ONLY a JSON object matching the schema: { "queries": [ { "text": string, "intent": ${QUERY_ANALYSIS_INTENT_JSON_UNION} } ] }.`,
    `${phraseLengthHint} Do not write full sentences, questions, or analyst-style commentary.`,
    `All queries must be in ${strategy.language} (BCP-47). Do not code-mix or translate ticker symbols and proper nouns.`,
    "Do not translate ticker symbols or proper nouns into other languages.",
    "Most queries should be bare topic keywords, industry terms, or regulatory terms that stand alone without the company name or ticker symbol. Only a small minority of your queries should name the company or ticker.",
    "Generate topic keywords across sectors, regulation, supply chain, ESG, and macro themes relevant to the company's operating environment.",
    [
      `Generate approximately ${String(strategy.queryCount)} queries in total, distributed across the intents below:`,
      intentTargetLines,
    ].join("\n"),
    `At least ${String(strategy.minDeterministicCount)} high-quality queries will be added deterministically by the system; your queries complement that set (avoid duplicating obvious symbol+news patterns).`,
    [
      "Intent meanings:",
      "- breaking: timely news, catalysts, and price-moving events",
      "- kg_change: knowledge-graph relation or entity changes",
      "- sentiment: social buzz, analyst tone, retail chatter, reputation swings",
      "- competitor: peer positioning, share shifts, competitive threats",
      "- supply_chain: suppliers, logistics, input costs, production bottlenecks",
      "- esg: environmental, social, governance risks and controversies",
      "- macro: rates, FX, commodity, and sector-wide drivers",
      "- technical: chart patterns, momentum, support/resistance, volume signals",
      "- regulatory: licensing, compliance, policy enforcement, rulemaking",
      "- technology_trend: digital disruption, AI adoption, tech shifts in the sector",
      "- geopolitical: trade, sanctions, cross-border dynamics affecting the sector",
      "- industry_trend: sector outlook, analyst views on the industry overall",
      "- deals: M&A, funding rounds, leadership appointments, and notable corporate actions",
    ].join("\n"),
  ];

  const base = sections.join("\n\n");
  return applyContractBrief(
    base,
    strategy.brief !== undefined ? { brief: strategy.brief } : undefined,
  );
};

/**
 * Formats rolling intent-level yield as a prompt hint block for the LLM user message.
 *
 * @param priorYield - Rolling yield rollups from GET /query-analysis.
 * @param windowDays - Rolling window length used for the summary.
 * @returns Multi-line hint block, or empty string when intent yield is absent.
 */
export const formatPriorYieldIntentHints = (
  priorYield: GetQueryAnalysisResponse["priorYield"],
  windowDays = 30,
): string => {
  if (priorYield === undefined || priorYield.perIntent.length === 0) {
    return "";
  }
  const parts = priorYield.perIntent
    .filter((row) => row.avgNovel > 0 || row.avgArticles > 0)
    .sort((left, right) => right.avgNovel - left.avgNovel)
    .map(
      (row) =>
        `${row.intent} queries surfaced ${row.avgNovel.toFixed(1)} novel articles each on average`,
    );
  if (parts.length === 0) {
    return "";
  }
  return [
    "Past performance hints:",
    `Last ${String(windowDays)} days — ${parts.join("; ")}.`,
    "Bias your generation accordingly.",
  ].join("\n");
};

/**
 * Serializes GET /query-analysis context for inclusion in the user prompt.
 *
 * @param context - Typed agent-data-api GET payload.
 * @param language - Optional BCP-47 language for localized entity display names.
 * @returns Multi-line context block (ticker, entities, themes, relation deltas).
 */
export const serializeQueryAnalysisContextBlock = (
  context: GetQueryAnalysisResponse,
  language?: string,
): string => {
  const companyName =
    language !== undefined
      ? resolveEntityDisplayName(
          context.ticker.symbol,
          context.ticker.name,
          language,
        )
      : context.ticker.name;
  const lines: string[] = [
    `Ticker symbol: ${context.ticker.symbol}`,
    `Company name: ${companyName}`,
  ];
  if (context.topEntities.length > 0) {
    lines.push("Top entities:");
    for (const e of context.topEntities) {
      lines.push(
        `- ${e.canonicalName} (${e.typeName}) relevance=${e.relevanceWeight}`,
      );
    }
  }
  if (context.recentThemes.length > 0) {
    lines.push("Recent themes:");
    for (const t of context.recentThemes) {
      lines.push(`- ${t.theme} (articles: ${t.articleCount})`);
    }
  }
  const deltas = context.recentRelationDeltas ?? [];
  if (deltas.length > 0) {
    lines.push("Recent relation deltas:");
    for (const d of deltas) {
      lines.push(
        `- ${d.fromEntity} → ${d.toEntity} [${d.relationType}] ${d.change}`,
      );
    }
  }
  if (context.peers.length > 0) {
    lines.push("Sector peers:");
    for (const peer of context.peers) {
      lines.push(`- ${peer.symbol} (${peer.name}) relevance=${peer.relevance}`);
    }
  }
  const calendar = context.calendar;
  if (calendar.recentEventTypes.length > 0) {
    lines.push("Calendar:");
    lines.push(`- Recent events: ${calendar.recentEventTypes.join(", ")}`);
  }
  if (context.headlineSamples.length > 0) {
    lines.push("Recent headlines:");
    for (const headline of context.headlineSamples) {
      const publishedDate = headline.publishedAt.slice(0, 10);
      lines.push(
        `- ${publishedDate} (${headline.sourceName}) — "${headline.title}"`,
      );
    }
  }
  if (context.kgNeighborhood.length > 0) {
    lines.push("KG neighborhood:");
    for (const edge of context.kgNeighborhood) {
      lines.push(
        `- ${edge.fromEntity} --${edge.relationType}--> ${edge.toEntity}`,
      );
    }
  }
  const yieldHints = formatPriorYieldIntentHints(context.priorYield);
  if (yieldHints.length > 0) {
    lines.push(yieldHints);
  }
  return lines.join("\n");
};

/**
 * Builds the query-analysis user prompt from serialized GET context.
 *
 * @param context - Live GET /query-analysis payload.
 * @param language - Optional BCP-47 language for localized entity display names.
 * @returns User message content for the chat model.
 */
export const buildQueryAnalysisUserContent = (
  context: GetQueryAnalysisResponse,
  language?: string,
): string => serializeQueryAnalysisContextBlock(context, language);

/**
 * Builds chat messages for the structured query-generation call.
 *
 * @param options - System/user content and optional few-shot exemplars.
 * @returns Message array for `generateObject`.
 */
export const buildStructuredQueryMessages = (options: {
  systemContent: string;
  userContent: string;
  fewShotExemplarCount: number;
}): ModelMessage[] => {
  const messages: ModelMessage[] = [
    {
      role: "system",
      content: options.systemContent,
    },
  ];

  for (const exemplar of selectFewShotExemplars(options.fewShotExemplarCount)) {
    messages.push({ role: "user", content: exemplar.context });
    messages.push({
      role: "assistant",
      content: formatExemplarAssistantContent(exemplar.queries),
    });
  }

  messages.push({ role: "user", content: options.userContent });
  return messages;
};

/** AI SDK v6 usage shape surfaced on `generateObject` results (optional in mocks). */
type GenerateObjectUsage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
};

export type GenerateObjectForWildcards = (args: {
  model: ReturnType<ReturnType<typeof createOpenAI>>;
  schema: typeof llmWildcardOutputSchema;
  messages: ModelMessage[];
}) => Promise<{
  object: z.infer<typeof llmWildcardOutputSchema>;
  usage?: GenerateObjectUsage;
}>;

export type GenerateObjectForQueries = (args: {
  model: ReturnType<ReturnType<typeof createOpenAI>>;
  schema: typeof llmQueriesOutputSchema;
  messages: ModelMessage[];
}) => Promise<{
  object: z.infer<typeof llmQueriesOutputSchema>;
  usage?: GenerateObjectUsage;
}>;

export type GenerateObjectForCritique = (args: {
  model: ReturnType<ReturnType<typeof createOpenAI>>;
  schema: typeof llmCritiqueOutputSchema;
  messages: ModelMessage[];
}) => Promise<{
  object: z.infer<typeof llmCritiqueOutputSchema>;
  usage?: GenerateObjectUsage;
}>;

/**
 * Calls the chat model with structured output; returns trimmed non-empty candidates with intents.
 * Throws on transport, API, or schema validation errors (caller handles fallback).
 *
 * @param params - API key, model id, and chat messages.
 * @param deps - Injectable `generateObject` (default: production `generateObject` from `ai`).
 * @returns LLM candidate rows (may be empty if the model returns only empty strings).
 */
export const fetchLlmQueryCandidates = async (
  params: {
    apiKey: string;
    model: string;
    messages: ModelMessage[];
    onUsage?: OnLlmUsage;
  },
  deps: { generateObjectForQueries: GenerateObjectForQueries } = {
    generateObjectForQueries: generateObject,
  },
): Promise<Array<{ text: string; intent: QueryAnalysisIntent }>> => {
  const openai = createOpenAI({ apiKey: params.apiKey });
  const { object, usage } = await deps.generateObjectForQueries({
    model: openai(params.model),
    schema: llmQueriesOutputSchema,
    messages: params.messages,
  });
  const normalizedUsage = extractLlmUsage(usage);
  if (normalizedUsage !== undefined) {
    params.onUsage?.(normalizedUsage);
  }

  return (object.queries ?? [])
    .map((q) => ({ text: q.text.trim(), intent: q.intent }))
    .filter((q) => q.text.length > 0);
};

/**
 * Builds the wildcard system prompt with inline slot count and language list.
 *
 * @param wildcardCount - Reserved wildcard slots for this run.
 * @param allowedLanguages - BCP-47 language codes for phrasing hints.
 * @returns System message content for the wildcard structured-output call.
 */
export const resolveWildcardSystemContent = (
  wildcardCount: number,
  allowedLanguages: string[],
  queryMaxWords?: number,
): string => {
  const maxWords = queryMaxWords ?? 5;
  const wordsHint =
    maxWords === 5
      ? "2–5 words per query"
      : `about ${String(maxWords)} words per query`;
  return [
    `Generate ${String(wildcardCount)} short search queries unlike anything an institutional analyst would typically search for.`,
    "Lateral, surprising, second-order, contrarian, or culturally-grounded angles welcome.",
    "Do not use the standard intent taxonomy — these queries are deliberately unconventional.",
    `Keep each query to ${wordsHint}. Prefer unusual keyword combinations over full questions or sentences.`,
    'Return ONLY a JSON object: { "queries": [ { "text": string } ] }.',
    `Write in these languages when natural (BCP-47 codes): ${allowedLanguages.join(", ")}.`,
  ].join("\n\n");
};

/**
 * Builds the wildcard user prompt from serialized GET context.
 *
 * @param context - Live GET /query-analysis payload.
 * @returns User message content for the wildcard call.
 */
export const resolveWildcardUserContent = (
  context: GetQueryAnalysisResponse,
): string => serializeQueryAnalysisContextBlock(context);

/**
 * Appends a dedupe nudge when regenerating wildcards after collision with existing rows.
 *
 * @param userContent - Base wildcard user message.
 * @param avoidTexts - Query texts the model must not repeat.
 * @returns User message with optional anti-duplication block.
 */
export const buildWildcardUserContentWithAvoidNudge = (
  userContent: string,
  avoidTexts: string[],
): string => {
  if (avoidTexts.length === 0) {
    return userContent;
  }
  const block = avoidTexts.map((text) => `- "${text}"`).join("\n");
  return [
    userContent,
    "",
    "Do NOT repeat or lightly rephrase these queries:",
    block,
    "",
    "Generate distinctly different lateral angles.",
  ].join("\n");
};

/**
 * Calls the chat model with minimal structured output for wildcard query slots.
 *
 * @param params - API key, model, token budget, count, and context.
 * @param deps - Injectable `generateObject` (default: production `generateObject` from `ai`).
 * @returns Trimmed wildcard candidate rows tagged with `intent: "wildcard"`.
 */
export const fetchWildcardCandidates = async (
  params: {
    apiKey: string;
    model: string;
    count: number;
    context: GetQueryAnalysisResponse;
    allowedLanguages: string[];
    avoidTexts?: string[];
    queryMaxWords?: number;
    onUsage?: OnLlmUsage;
  },
  deps: { generateObjectForWildcards: GenerateObjectForWildcards } = {
    generateObjectForWildcards: generateObject,
  },
): Promise<Array<{ text: string; intent: "wildcard" }>> => {
  const openai = createOpenAI({ apiKey: params.apiKey });
  const systemContent = resolveWildcardSystemContent(
    params.count,
    params.allowedLanguages,
    params.queryMaxWords,
  );
  const userContent = buildWildcardUserContentWithAvoidNudge(
    resolveWildcardUserContent(params.context),
    params.avoidTexts ?? [],
  );
  const { object, usage } = await deps.generateObjectForWildcards({
    model: openai(params.model),
    schema: llmWildcardOutputSchema,
    messages: [
      { role: "system", content: systemContent },
      { role: "user", content: userContent },
    ],
  });
  const normalizedUsage = extractLlmUsage(usage);
  if (normalizedUsage !== undefined) {
    params.onUsage?.(normalizedUsage);
  }

  return (object.queries ?? [])
    .map((q) => ({ text: q.text.trim(), intent: "wildcard" as const }))
    .filter((q) => q.text.length > 0)
    .slice(0, params.count);
};

export type FetchLlmQueryCandidatesByPersonaParams = {
  apiKey: string;
  model: string;
  systemContent: string;
  userContent: string;
  personas: QueryPersona[];
  perPersonaQuota: number;
  fewShotExemplarCount: number;
  /** Optional extra system instruction (e.g. diversity-gate broaden nudge). */
  broadenSystemNudge?: string;
  /** Optional sink for per-call token usage across every persona call. */
  onUsage?: OnLlmUsage;
};

/**
 * Runs one structured LLM call per persona in parallel and tags each row with its persona id.
 * A failing persona is logged and skipped; surviving personas still contribute candidates.
 *
 * @param params - Shared prompt content, persona list, and per-persona cap.
 * @param deps - Injectable structured-output runner and optional warn logger.
 * @returns Flattened LLM candidates tagged with `persona` ids.
 */
export const fetchLlmQueryCandidatesByPersona = async (
  params: FetchLlmQueryCandidatesByPersonaParams,
  deps: {
    fetchLlmQueryCandidates?: typeof fetchLlmQueryCandidates;
    warn?: (
      message: string,
      meta: { personaId: string; error: unknown },
    ) => void;
  } = {},
): Promise<LlmCandidate[]> => {
  const runStructured = deps.fetchLlmQueryCandidates ?? fetchLlmQueryCandidates;
  const warn =
    deps.warn ??
    (() => {
      /* no-op default for tests */
    });

  const results = await Promise.all(
    params.personas.map(async (persona) => {
      try {
        const systemContent = [
          params.systemContent,
          params.broadenSystemNudge,
          persona.systemNudge,
        ]
          .filter((part) => part !== undefined && part.length > 0)
          .join("\n\n");
        const messages = buildStructuredQueryMessages({
          systemContent,
          userContent: params.userContent,
          fewShotExemplarCount: params.fewShotExemplarCount,
        });
        const rows = await runStructured({
          apiKey: params.apiKey,
          model: params.model,
          messages,
          ...(params.onUsage !== undefined ? { onUsage: params.onUsage } : {}),
        });
        return rows.slice(0, params.perPersonaQuota).map((row) => ({
          ...row,
          persona: persona.id,
        }));
      } catch (error) {
        warn("query-analysis persona LLM call failed; skipping persona", {
          personaId: persona.id,
          error,
        });
        return [];
      }
    }),
  );

  return results.flat();
};

/** Default wall-clock budget for the self-critique pass before shipping original candidates. */
export const DEFAULT_CRITIC_PASS_DEADLINE_MS = 30_000;

/**
 * Builds the critique system prompt instructing the model to score and flag weak rows.
 *
 * @param dropFraction - Configured fraction of candidates eligible for replacement.
 * @returns System message content for the critique call.
 */
export const buildCritiqueSystemContent = (dropFraction: number): string => {
  const pct = Math.round(dropFraction * 100);
  return [
    "You are reviewing finance search queries another model generated for a ticker.",
    "Rate each query's relevance to the company context (1=off-topic, 5=highly relevant) and novelty (1=generic duplicate, 5=fresh angle).",
    `Mark roughly the worst ${String(pct)}% as drop: true — only queries that should be replaced.`,
    'Return ONLY JSON: { "ratings": [ { "text": string, "relevance": number, "novelty": number, "drop": boolean } ] }.',
    "Include one rating object per input query using the exact query text.",
  ].join("\n");
};

/**
 * Serializes candidate rows for the critique user message.
 *
 * @param candidates - LLM rows to score.
 * @returns Numbered bullet list for the critique call.
 */
export const formatCandidatesForCritique = (
  candidates: LlmCandidate[],
): string =>
  candidates
    .map((row, index) => `${String(index + 1)}. "${row.text}" (${row.intent})`)
    .join("\n");

/**
 * Selects which candidates to drop after critique, capped by `dropFraction`.
 *
 * @param candidates - Original candidate rows.
 * @param ratings - Model critique output aligned by query text.
 * @param dropFraction - Maximum fraction of rows that may be replaced.
 * @returns Rows to remove (worst among those flagged `drop`, up to the cap).
 */
export const selectCandidatesToDropFromCritique = (
  candidates: LlmCandidate[],
  ratings: CritiqueRating[],
  dropFraction: number,
): LlmCandidate[] => {
  if (candidates.length === 0 || dropFraction <= 0) {
    return [];
  }
  const maxDrop = Math.floor(candidates.length * dropFraction);
  if (maxDrop === 0) {
    return [];
  }

  const ratingByKey = new Map(
    ratings.map((rating) => [normalizeQueryKey(rating.text), rating]),
  );

  const flagged = candidates
    .filter((candidate) => {
      const rating = ratingByKey.get(normalizeQueryKey(candidate.text));
      return rating?.drop === true;
    })
    .sort((a, b) => {
      const ratingA = ratingByKey.get(normalizeQueryKey(a.text));
      const ratingB = ratingByKey.get(normalizeQueryKey(b.text));
      const scoreA = (ratingA?.relevance ?? 0) + (ratingA?.novelty ?? 0);
      const scoreB = (ratingB?.relevance ?? 0) + (ratingB?.novelty ?? 0);
      return scoreA - scoreB;
    });

  return flagged.slice(0, maxDrop);
};

/**
 * Merges kept candidates with replacement rows, preserving optional persona tags.
 *
 * @param candidates - Full original candidate list.
 * @param toDrop - Rows removed by critique.
 * @param replacements - New rows from the regenerator (length should match `toDrop`).
 * @returns Candidate list with the same length as the input when replacements fill the gap.
 */
export const mergeCritiqueReplacements = (
  candidates: LlmCandidate[],
  toDrop: LlmCandidate[],
  replacements: LlmCandidate[],
): LlmCandidate[] => {
  const dropKeys = new Set(toDrop.map((row) => normalizeQueryKey(row.text)));
  const kept = candidates.filter(
    (row) => !dropKeys.has(normalizeQueryKey(row.text)),
  );
  const persona = toDrop[0]?.persona;
  const taggedReplacements = replacements.map((row) => ({
    ...row,
    ...(persona !== undefined ? { persona } : {}),
  }));
  return [...kept, ...taggedReplacements];
};

/**
 * Calls the critique model to score each candidate against live ticker context.
 *
 * @param params - API key, model, context, candidates, and drop fraction.
 * @param deps - Injectable `generateObject` for the critique schema.
 * @returns Parsed critique ratings (may be empty on model output gaps).
 */
export const critiqueQueryCandidates = async (
  params: {
    apiKey: string;
    model: string;
    context: GetQueryAnalysisResponse;
    candidates: LlmCandidate[];
    dropFraction: number;
    onUsage?: OnLlmUsage;
  },
  deps: { generateObjectForCritique: GenerateObjectForCritique } = {
    generateObjectForCritique: generateObject,
  },
): Promise<CritiqueRating[]> => {
  const openai = createOpenAI({ apiKey: params.apiKey });
  const userContent = [
    buildQueryAnalysisUserContent(params.context),
    "",
    "Queries to critique:",
    formatCandidatesForCritique(params.candidates),
  ].join("\n");
  const { object, usage } = await deps.generateObjectForCritique({
    model: openai(params.model),
    schema: llmCritiqueOutputSchema,
    messages: [
      {
        role: "system",
        content: buildCritiqueSystemContent(params.dropFraction),
      },
      { role: "user", content: userContent },
    ],
  });
  const normalizedUsage = extractLlmUsage(usage);
  if (normalizedUsage !== undefined) {
    params.onUsage?.(normalizedUsage);
  }

  return object.ratings ?? [];
};

/**
 * Regenerates replacement queries for rows dropped by critique.
 *
 * @param params - Generation prompt, kept anti-examples, and replacement count.
 * @param deps - Injectable structured-output runner.
 * @returns Up to `dropCount` new candidate rows.
 */
export const regenerateDroppedQueries = async (
  params: {
    apiKey: string;
    model: string;
    systemContent: string;
    userContent: string;
    keptCandidates: LlmCandidate[];
    dropCount: number;
    fewShotExemplarCount: number;
    onUsage?: OnLlmUsage;
  },
  deps: { fetchLlmQueryCandidates?: typeof fetchLlmQueryCandidates } = {},
): Promise<LlmCandidate[]> => {
  const runStructured = deps.fetchLlmQueryCandidates ?? fetchLlmQueryCandidates;
  if (params.dropCount <= 0) {
    return [];
  }

  const keptBlock = params.keptCandidates
    .map((row) => `- "${row.text}"`)
    .join("\n");
  const replacementSystem = [
    params.systemContent,
    "",
    "You already produced these queries — do NOT restate or lightly rephrase them:",
    keptBlock.length > 0 ? keptBlock : "(none)",
    "",
    `Generate exactly ${String(params.dropCount)} new, distinct search queries in the JSON response.`,
  ].join("\n");

  const messages = buildStructuredQueryMessages({
    systemContent: replacementSystem,
    userContent: params.userContent,
    fewShotExemplarCount: params.fewShotExemplarCount,
  });

  const rows = await runStructured({
    apiKey: params.apiKey,
    model: params.model,
    messages,
    ...(params.onUsage !== undefined ? { onUsage: params.onUsage } : {}),
  });

  return rows.slice(0, params.dropCount);
};

/**
 * Runs critique → drop → regenerate for one homogeneous candidate batch (same persona or untagged).
 *
 * @param candidates - LLM rows to refine (non-empty).
 * @param params - Shared critique/regeneration configuration.
 * @param deps - Injectable critique and regeneration collaborators.
 * @returns Refined candidates and how many rows were replaced.
 */
export const applySelfCritiqueToCandidateBatch = async (
  candidates: LlmCandidate[],
  params: {
    apiKey: string;
    critiqueModel: string;
    generationModel: string;
    systemContent: string;
    userContent: string;
    context: GetQueryAnalysisResponse;
    dropFraction: number;
    fewShotExemplarCount: number;
    onUsage?: OnLlmUsage;
  },
  deps: {
    critiqueQueryCandidates?: typeof critiqueQueryCandidates;
    regenerateDroppedQueries?: typeof regenerateDroppedQueries;
  } = {},
): Promise<{ candidates: LlmCandidate[]; replacedCount: number }> => {
  const runCritique = deps.critiqueQueryCandidates ?? critiqueQueryCandidates;
  const runRegenerate =
    deps.regenerateDroppedQueries ?? regenerateDroppedQueries;

  const ratings = await runCritique({
    apiKey: params.apiKey,
    model: params.critiqueModel,
    context: params.context,
    candidates,
    dropFraction: params.dropFraction,
    ...(params.onUsage !== undefined ? { onUsage: params.onUsage } : {}),
  });

  const toDrop = selectCandidatesToDropFromCritique(
    candidates,
    ratings,
    params.dropFraction,
  );
  if (toDrop.length === 0) {
    return { candidates, replacedCount: 0 };
  }

  const dropKeys = new Set(toDrop.map((row) => normalizeQueryKey(row.text)));
  const keptCandidates = candidates.filter(
    (row) => !dropKeys.has(normalizeQueryKey(row.text)),
  );

  const replacements = await runRegenerate({
    apiKey: params.apiKey,
    model: params.generationModel,
    systemContent: params.systemContent,
    userContent: params.userContent,
    keptCandidates,
    dropCount: toDrop.length,
    fewShotExemplarCount: params.fewShotExemplarCount,
    ...(params.onUsage !== undefined ? { onUsage: params.onUsage } : {}),
  });

  return {
    candidates: mergeCritiqueReplacements(candidates, toDrop, replacements),
    replacedCount: toDrop.length,
  };
};

/**
 * Applies self-critique per persona group (when tagged) or once for the full LLM pool.
 *
 * @param params - Candidates, timing budget, and critique/regeneration configuration.
 * @param deps - Injectable batch critique runner and clock for deadline checks.
 * @returns Refined candidates plus observability metadata for the strategy snapshot.
 */
export const applySelfCritiquePass = async (
  params: {
    apiKey: string;
    critiqueModel: string;
    generationModel: string;
    systemContent: string;
    userContent: string;
    context: GetQueryAnalysisResponse;
    candidates: LlmCandidate[];
    dropFraction: number;
    fewShotExemplarCount: number;
    runStartMs: number;
    deadlineMs: number;
    onUsage?: OnLlmUsage;
  },
  deps: {
    applySelfCritiqueToCandidateBatch?: typeof applySelfCritiqueToCandidateBatch;
    critiqueQueryCandidates?: typeof critiqueQueryCandidates;
    regenerateDroppedQueries?: typeof regenerateDroppedQueries;
    now?: () => number;
  } = {},
): Promise<{
  candidates: LlmCandidate[];
  replacedCount: number;
  skippedDueToDeadline: boolean;
}> => {
  const runBatch =
    deps.applySelfCritiqueToCandidateBatch ?? applySelfCritiqueToCandidateBatch;
  const now = deps.now ?? (() => Date.now());

  if (params.candidates.length === 0) {
    return { candidates: [], replacedCount: 0, skippedDueToDeadline: false };
  }

  if (now() - params.runStartMs > params.deadlineMs) {
    return {
      candidates: params.candidates,
      replacedCount: 0,
      skippedDueToDeadline: true,
    };
  }

  const hasPersonaTags = params.candidates.some(
    (row) => row.persona !== undefined,
  );
  const batches: LlmCandidate[][] = hasPersonaTags
    ? [...groupCandidatesByPersona(params.candidates).values()]
    : [params.candidates];

  let replacedCount = 0;
  const refined: LlmCandidate[] = [];

  for (const batch of batches) {
    if (now() - params.runStartMs > params.deadlineMs) {
      refined.push(...batch);
      continue;
    }
    const batchDeps = {
      critiqueQueryCandidates: deps.critiqueQueryCandidates,
      regenerateDroppedQueries: deps.regenerateDroppedQueries,
    };
    const result = await runBatch(batch, params, batchDeps);
    replacedCount += result.replacedCount;
    refined.push(...result.candidates);
  }

  return {
    candidates: refined,
    replacedCount,
    skippedDueToDeadline: false,
  };
};

/**
 * Groups persona-tagged candidates by persona id, preserving first-seen persona order.
 *
 * @param candidates - LLM rows that may carry persona tags.
 * @returns Map of persona id → candidate rows in original order within each bucket.
 */
export const groupCandidatesByPersona = (
  candidates: LlmCandidate[],
): Map<string, LlmCandidate[]> => {
  const groups = new Map<string, LlmCandidate[]>();
  for (const row of candidates) {
    const personaId = row.persona ?? "__default__";
    const bucket = groups.get(personaId) ?? [];
    bucket.push(row);
    groups.set(personaId, bucket);
  }
  return groups;
};
