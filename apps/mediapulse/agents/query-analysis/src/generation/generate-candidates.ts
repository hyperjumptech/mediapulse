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
import {
  generatedCandidateSchema,
  queryAnalysisIntentForNumber,
} from "./schema";
import GENERATION_SYSTEM_PROMPT_TEMPLATE from "./generation-system-prompt.txt";

export interface GenerationLogger {
  warn: (obj: object, msg?: string) => void;
}

export interface GenerateQueryCandidatesInput {
  ticker: { symbol: string; name: string; aliases?: string[] };
  classification: Classification;
  market: MarketContext;
  contractBrief: string;
  competitors: DiscoveredEntity[];
  regulators: DiscoveredEntity[];
  mainInputs?: string[];
  customerSegments?: string[];
  languages: readonly Language[];
  currentDate: string;
  ai: QueryAnalysisAiConfig;
  excludeQueries?: string[];
  generate?: typeof generateObject;
  onUsage?: OnLlmUsage;
  logger?: GenerationLogger;
}

const joinSlash = (...parts: Array<string | undefined | null>): string =>
  parts.filter((part): part is string => Boolean(part)).join(" / ");

const renderEntities = (entities: DiscoveredEntity[]): string =>
  entities
    .map((entity) =>
      entity.aliases.length > 0
        ? `${entity.name} (aka ${entity.aliases.join(", ")})`
        : entity.name,
    )
    .join(", ");

const stripTrailingPunctuation = (text: string): string =>
  text.replace(/[\s.,;]+$/u, "");

const decodeElements = (elements: unknown[]): Candidate[] =>
  elements.flatMap((element) => {
    const parsed = generatedCandidateSchema.safeParse(element);
    if (!parsed.success) return [];
    const intent = queryAnalysisIntentForNumber(parsed.data.i);
    if (intent === null) return [];
    const text = stripTrailingPunctuation(parsed.data.s.trim());
    if (text.length === 0) return [];

    return [{ text, intent, language: parsed.data.l }];
  });

const extractErrorText = (error: unknown): string | undefined =>
  error !== null &&
  typeof error === "object" &&
  "text" in error &&
  typeof (error as { text?: unknown }).text === "string"
    ? (error as { text: string }).text
    : undefined;

const parseElements = (rawText: string): unknown[] => {
  const asElements = (value: unknown): unknown[] | undefined => {
    if (Array.isArray(value)) return value;
    if (
      value !== null &&
      typeof value === "object" &&
      Array.isArray((value as { elements?: unknown }).elements)
    ) {
      return (value as { elements: unknown[] }).elements;
    }

    return undefined;
  };
  const tryParse = (candidate: string): unknown => {
    try {
      return JSON.parse(candidate);
    } catch {
      return undefined;
    }
  };
  const whole = asElements(tryParse(rawText));
  if (whole) return whole;
  const start = rawText.indexOf("[");
  const end = rawText.lastIndexOf("]");
  if (start !== -1 && end > start) {
    const sliced = asElements(tryParse(rawText.slice(start, end + 1)));
    if (sliced) return sliced;
  }

  return [];
};

const buildSystemPrompt = (
  contractBrief: string,
  currentDate: string,
  homeMarket: string,
): string => {
  const replacements: Record<string, string> = {
    CONTRACT_BRIEF: contractBrief.trim(),
    HOME_MARKET: homeMarket,
    CURRENT_DATE: currentDate,
    CANDIDATE_TARGET: String(GENERATION_CANDIDATE_TARGET),
  };

  return GENERATION_SYSTEM_PROMPT_TEMPLATE.replace(
    /\{\{(\w+)\}\}/g,
    (match, name: string) =>
      Object.prototype.hasOwnProperty.call(replacements, name)
        ? (replacements[name] ?? match)
        : match,
  );
};

const buildPrompt = (input: GenerateQueryCandidatesInput): string => {
  const aliasClause =
    input.ticker.aliases && input.ticker.aliases.length > 0
      ? ` — also known as ${input.ticker.aliases.join(", ")}`
      : "";
  const sectorLine = joinSlash(
    input.classification.sector,
    input.classification.industry,
  );
  const subSectorLine = joinSlash(
    input.classification.subSector,
    input.classification.subIndustry,
  );
  const mainInputs = input.mainInputs ?? [];
  const customerSegments = input.customerSegments ?? [];

  return [
    `Company: ${input.ticker.name} (${input.ticker.symbol})${aliasClause}`,
    `Home market: ${input.market.homeMarket} — anchors: ${input.market.anchors.join(", ")}`,
    sectorLine ? `Sector: ${sectorLine}` : null,
    subSectorLine ? `Sub-sector: ${subSectorLine}` : null,
    input.classification.businessActivity
      ? `Main business: ${input.classification.businessActivity}`
      : null,
    mainInputs.length > 0 ? `Main inputs: ${mainInputs.join(", ")}` : null,
    customerSegments.length > 0
      ? `Customer segments: ${customerSegments.join(", ")}`
      : null,
    input.competitors.length > 0
      ? `Competitors: ${renderEntities(input.competitors)}`
      : "Competitors: none discovered yet.",
    input.regulators.length > 0
      ? `Regulators: ${renderEntities(input.regulators)}`
      : "Regulators: none discovered yet.",
    `Languages: ${input.languages.join(", ")}`,
    ...(input.excludeQueries && input.excludeQueries.length > 0
      ? [
          "",
          "These queries already returned zero results — do not repeat them; try",
          "different phrasing or angles for the same intents:",
          ...input.excludeQueries.map((query) => `- ${query}`),
        ]
      : []),
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
};

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
      output: "array",
      schema: generatedCandidateSchema,
      system: buildSystemPrompt(
        input.contractBrief,
        input.currentDate,
        input.market.homeMarket,
      ),
      prompt: buildPrompt(input),
      maxRetries: GENERATION_LLM_MAX_RETRIES,
    });
    const usage = extractLlmUsage(result.usage);
    if (usage !== undefined) {
      input.onUsage?.(usage);
    }

    return decodeElements(result.object);
  } catch (error) {
    const rawText = extractErrorText(error);
    const salvaged = rawText ? decodeElements(parseElements(rawText)) : [];
    if (salvaged.length > 0) {
      input.logger?.warn(
        {
          tickerSymbol: input.ticker.symbol,
          salvaged: salvaged.length,
          sample: salvaged.slice(0, 5).map((candidate) => candidate.text),
        },
        "query-analysis generation did not match schema; salvaged valid candidates from raw output",
      );

      return salvaged;
    }

    input.logger?.warn(
      {
        tickerSymbol: input.ticker.symbol,
        errName: (error as { name?: string })?.name,
        rawSample: rawText?.slice(0, 500),
      },
      "query-analysis candidate generation failed; returning no candidates for this attempt",
    );

    return [];
  }
};
