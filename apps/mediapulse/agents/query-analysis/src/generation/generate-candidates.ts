import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { extractLlmUsage, type OnLlmUsage } from "@workspace/agent-runtime";

import type { QueryAnalysisAiConfig } from "../config-schema";
import {
  GENERATION_CANDIDATE_TARGET,
  GENERATION_LLM_MAX_RETRIES,
} from "../constants";
import type { Classification, MarketContext } from "../pipeline/context";
import type { Candidate, Language } from "../pipeline/types";
import type { DiscoveredEntity } from "../discovery/schema";
import { candidateGenerationResultSchema } from "./schema";

/** Minimal logger surface for the generation step. */
export interface GenerationLogger {
  warn: (obj: object, msg?: string) => void;
}

/** Inputs for one LLM query-candidate-generation call. */
export interface GenerateQueryCandidatesInput {
  ticker: { symbol: string; name: string };
  classification: Classification;
  market: MarketContext;
  /** Agent contract brief. Guaranteed present (requireContract). Steers generation. */
  contractBrief: string;
  competitors: DiscoveredEntity[];
  regulators: DiscoveredEntity[];
  languages: readonly Language[];
  ai: QueryAnalysisAiConfig;
  /** Query texts already tried and confirmed to return zero search results (retry feedback). */
  excludeQueries?: string[];
  /** Injectable for tests; defaults to the AI SDK `generateObject`. */
  generate?: typeof generateObject;
  onUsage?: OnLlmUsage;
  logger?: GenerationLogger;
}

const classificationLines = (classification: Classification): string[] => {
  const lines: string[] = [];
  if (classification.sector) {
    lines.push(`Sector: ${classification.sector}`);
  }
  if (classification.industry) {
    lines.push(`Industry: ${classification.industry}`);
  }
  if (classification.subSector) {
    lines.push(`Sub-sector: ${classification.subSector}`);
  }
  if (classification.subIndustry) {
    lines.push(`Sub-industry: ${classification.subIndustry}`);
  }
  if (classification.businessActivity) {
    lines.push(`Main business activity: ${classification.businessActivity}`);
  }

  return lines;
};

const renderEntities = (entities: DiscoveredEntity[]): string =>
  entities
    .map((entity) =>
      entity.aliases.length > 0
        ? `${entity.name} (aka ${entity.aliases.join(", ")})`
        : entity.name,
    )
    .join("; ");

const buildSystemPrompt = (contractBrief: string): string =>
  [
    `<product_contract>\n${contractBrief.trim()}\n</product_contract>`,
    "",
    "You generate web-search query candidates that will be run against search providers",
    "to collect news for an investment-research newsletter. Use the product contract above",
    "as the steering context for what matters to this product. Return realistic, high-signal",
    "search queries only — the kind a research analyst would actually type.",
  ].join("\n");

const buildPrompt = (input: GenerateQueryCandidatesInput): string =>
  [
    `Generate web-search query candidates for the company below, anchored to its ${input.market.homeMarket} home market where relevant.`,
    "",
    `Company: ${input.ticker.name} (${input.ticker.symbol})`,
    `Home market: ${input.market.homeMarket} (market anchors: ${input.market.anchors.join(", ")})`,
    ...classificationLines(input.classification),
    "",
    input.competitors.length > 0
      ? `Known competitors: ${renderEntities(input.competitors)}`
      : "No competitors discovered yet.",
    input.regulators.length > 0
      ? `Known regulators/policy bodies: ${renderEntities(input.regulators)}`
      : "No regulators discovered yet.",
    "",
    `Languages to phrase queries in: ${input.languages.join(", ")}. Use natural phrasing per`,
    "language; skip a language for a given candidate if it wouldn't read naturally.",
    "",
    "Generate candidates for these intents:",
    "- breaking: news specifically about this company's own developments (not sector-wide).",
    "- deals: corporate-action queries for this company (M&A, rights issue, dividend, RUPS, etc).",
    "- competitor: news about the specific competitors listed above (use their names/aliases).",
    "- regulatory: news about the specific regulators/policy bodies listed above.",
    "- industry_trend: sector/industry-wide trend queries anchored to the home market.",
    "- technology_trend: technology/digital-disruption queries relevant to this sector.",
    "- macro: macroeconomic queries relevant to this sector and home market.",
    "- wildcard: a small number of exploratory/emerging-trend queries for this sector.",
    "",
    "CRITICAL — avoid ambiguous bare queries: before emitting the bare ticker symbol or company",
    "name alone as a query (especially for `breaking`), check whether it is also an ordinary word,",
    'idiom, or brand name in English or Indonesian. For example, a ticker like "FORE" is also the',
    'English word "fore" (as in "comes to the fore"), the golf term "fore!", and the golf brand',
    '"G/FORE" — searching that bare symbol surfaces unrelated golf and geopolitics news instead of',
    "the actual company. If the symbol or name risks this kind of collision, qualify it with a",
    'disambiguating term (e.g. the exchange, "saham", the sector, or more of the company name)',
    "instead of emitting it bare. Only emit an unqualified bare symbol or name when it is clearly",
    "distinctive and unlikely to collide with unrelated common usage.",
    ...(input.excludeQueries && input.excludeQueries.length > 0
      ? [
          "",
          "The following queries were already tried and returned zero search results — do not",
          "repeat them; propose different phrasing or angles for the same intents instead:",
          ...input.excludeQueries.map((query) => `- ${query}`),
        ]
      : []),
    "",
    `Return up to ${GENERATION_CANDIDATE_TARGET} candidates total, spread across the intents above`,
    "(not just breaking).",
  ].join("\n");

/**
 * Generates search-query candidates for one ticker via a single LLM call, steered by the
 * agent contract brief and explicitly instructed to avoid ambiguous bare-symbol collisions.
 *
 * - Important: Returns an empty array on any LLM failure (after {@link GENERATION_LLM_MAX_RETRIES}
 *   SDK retries). The caller treats a run that yields no queries as a no-op that leaves the
 *   ticker's previous active query set in place, so a transient outage never overwrites good
 *   queries with a degraded set.
 *
 * @param input - Ticker identity, classification, market, contract brief, discovered
 *   entities, languages, LLM credentials, and optional zero-hit `excludeQueries` feedback.
 * @returns Generated candidates, or an empty array when the LLM call fails.
 */
export const generateQueryCandidates = async (
  input: GenerateQueryCandidatesInput,
): Promise<Candidate[]> => {
  const generate = input.generate ?? generateObject;

  try {
    const openai = createOpenAI({
      apiKey: input.ai.apiKey,
      ...(input.ai.baseUrl ? { baseURL: input.ai.baseUrl } : {}),
    });

    const result = await generate({
      model: openai(input.ai.model),
      schema: candidateGenerationResultSchema,
      system: buildSystemPrompt(input.contractBrief),
      prompt: buildPrompt(input),
      maxRetries: GENERATION_LLM_MAX_RETRIES,
    });
    const usage = extractLlmUsage(result.usage);
    if (usage !== undefined) {
      input.onUsage?.(usage);
    }

    return result.object.candidates.map((candidate) => ({
      text: candidate.text,
      intent: candidate.intent,
      language: candidate.language,
    }));
  } catch (error) {
    input.logger?.warn(
      { err: error, tickerSymbol: input.ticker.symbol },
      "query-analysis candidate generation failed; returning no candidates for this attempt",
    );

    return [];
  }
};
