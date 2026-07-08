import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { extractLlmUsage, type OnLlmUsage } from "@workspace/agent-runtime";

import type { QueryAnalysisAiConfig } from "../config-schema";
import type { Classification } from "../pipeline/context";
import {
  discoveryResultSchema,
  type DiscoveredEntity,
  type DiscoveryResult,
} from "./schema";

/** Minimal logger surface for the discovery step. */
export interface DiscoveryLogger {
  warn: (obj: object, msg?: string) => void;
}

/** Inputs for one LLM entity-discovery call. */
export interface DiscoverEntitiesInput {
  tickerName: string;
  tickerSymbol: string;
  classification: Classification;
  homeMarket: string;
  /** Agent contract brief. Guaranteed present (requireContract). Steers discovery. */
  contractBrief: string;
  ai: QueryAnalysisAiConfig;
  maxCompetitors: number;
  maxRegulators: number;
  maxKeywordsPerEntity: number;
  /** Injectable for tests; defaults to the AI SDK `generateObject`. */
  generate?: typeof generateObject;
  onUsage?: OnLlmUsage;
  logger?: DiscoveryLogger;
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

const buildPrompt = (input: DiscoverEntitiesInput): string =>
  [
    `Identify the direct competitors and the regulators/policy bodies for the company below, focused on its ${input.homeMarket} home market.`,
    "",
    `Company: ${input.tickerName} (${input.tickerSymbol})`,
    `Home market: ${input.homeMarket}`,
    ...classificationLines(input.classification),
    "",
    `Return up to ${input.maxCompetitors} real, named competitors and up to ${input.maxRegulators} real regulators or policy bodies.`,
    "Competitors must be actual rival companies (prefer listed peers in the same market). Regulators must be real oversight or policy bodies that materially affect this company or its sector.",
    `For each entity, provide its common name, any well-known aliases or ticker symbols, and 1-${input.maxKeywordsPerEntity} short search keywords that surface news about it.`,
    "Also identify, specific to this company's home market:",
    "- main_inputs: the key commodities, raw materials, or services this company buys whose prices move its margins.",
    "- customer_segments: who buys from this sector, in plain terms.",
    "Keep main_inputs and customer_segments short (up to 8 items each), concrete, and non-generic.",
    "Do not invent entities. If you are unsure, return fewer rather than fabricating.",
  ].join("\n");

const MAX_DISCOVERY_CONTEXT_ITEMS = 8;

const capEntity = (
  entity: DiscoveredEntity,
  maxKeywordsPerEntity: number,
): DiscoveredEntity => ({
  ...entity,
  searchKeywords: entity.searchKeywords.slice(0, maxKeywordsPerEntity),
});

const capResult = (
  result: DiscoveryResult,
  input: DiscoverEntitiesInput,
): DiscoveryResult => ({
  competitors: result.competitors
    .slice(0, input.maxCompetitors)
    .map((entity) => capEntity(entity, input.maxKeywordsPerEntity)),
  regulators: result.regulators
    .slice(0, input.maxRegulators)
    .map((entity) => capEntity(entity, input.maxKeywordsPerEntity)),
  mainInputs: result.mainInputs.slice(0, MAX_DISCOVERY_CONTEXT_ITEMS),
  customerSegments: result.customerSegments.slice(
    0,
    MAX_DISCOVERY_CONTEXT_ITEMS,
  ),
});

/**
 * Discovers competitors and regulators for one ticker via a single LLM call,
 * steered by the agent contract brief.
 *
 * - Important: Degrades to an empty result (own-company + industry only) on any
 *   LLM failure, so the pipeline never blocks on discovery.
 *
 * @param input - Ticker identity, classification, contract brief, and LLM credentials.
 * @returns Capped competitors and regulators, or empty arrays on failure.
 */
export const discoverEntities = async (
  input: DiscoverEntitiesInput,
): Promise<DiscoveryResult> => {
  const generate = input.generate ?? generateObject;

  try {
    const openai = createOpenAI({
      apiKey: input.ai.apiKey,
      ...(input.ai.baseUrl ? { baseURL: input.ai.baseUrl } : {}),
    });

    const result = await generate({
      model: openai(input.ai.model),
      schema: discoveryResultSchema,
      system: `<product_contract>\n${input.contractBrief.trim()}\n</product_contract>\n\nYou map an issuer's competitive and regulatory landscape for an investment-research agent. Use the product contract above as the steering context for what matters. Return only real, verifiable entities.`,
      prompt: buildPrompt(input),
      maxRetries: 0,
    });
    const usage = extractLlmUsage(result.usage);
    if (usage !== undefined) {
      input.onUsage?.(usage);
    }

    return capResult(result.object, input);
  } catch (error) {
    input.logger?.warn(
      { err: error, tickerSymbol: input.tickerSymbol },
      "query-analysis entity discovery failed; degrading to own-company + industry only",
    );

    return {
      competitors: [],
      regulators: [],
      mainInputs: [],
      customerSegments: [],
    };
  }
};
