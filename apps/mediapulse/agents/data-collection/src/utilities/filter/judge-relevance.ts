import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import { isRelevant } from "@workspace/agent-ingestion";

import type { RelevanceConfig } from "../config-schema";

/** Relevance decision returned by the filter. */
export type RelevanceDecision =
  | { keep: true; via: "llm" | "keyword" }
  | { keep: false; reason: "irrelevant"; via: "llm" | "keyword" };

/** Characters of leading content shown to the judge and the keyword fallback. */
const HEAD_CHARS = 6000;

const relevanceResultSchema = z.object({
  relevant: z.boolean(),
  reason: z.string(),
});

/** Minimal logger surface for the relevance judge. */
export interface RelevanceLogger {
  info: (obj: object, msg?: string) => void;
  warn: (obj: object, msg?: string) => void;
}

export interface JudgeRelevanceInput {
  title: string;
  content: string;
  tickerSymbol: string;
  tickerName: string;
  /** Lowercased ticker aliases used by the keyword fallback. */
  tickerAliases: string[];
  /** Lowercased industry aliases used by the keyword fallback. */
  industryAliases: string[];
  /** Main business activity (IDX `KegiatanUsahaUtama`), when known. */
  businessActivity?: string | null;
  /** Sub-industry label (IDX `SubIndustri`), when known. */
  subIndustry?: string | null;
  /** Peer/competitor display names surfaced for competitive-landscape relevance. */
  peerNames?: string[];
  /** Agent contract brief. When empty, the keyword fallback is used. */
  contractBrief?: string;
  llm: RelevanceConfig;
  /** Injectable for tests; defaults to the AI SDK `generateObject`. */
  generate?: typeof generateObject;
  logger?: RelevanceLogger;
}

/** Runs the keyword/alias relevance check used as the fallback. */
const keywordFallback = (input: JudgeRelevanceInput): RelevanceDecision => {
  const decision = isRelevant(
    {
      title: input.title,
      content: input.content,
      aliases: input.tickerAliases,
      industryAliases: input.industryAliases,
    },
    { headChars: HEAD_CHARS, minMatches: 1 },
  );

  return decision.relevant
    ? { keep: true, via: "keyword" }
    : { keep: false, reason: "irrelevant", via: "keyword" };
};

const buildPrompt = (input: JudgeRelevanceInput): string => {
  const industry =
    input.industryAliases.length > 0
      ? input.industryAliases.join(", ")
      : "its industry";
  const head = input.content.slice(0, HEAD_CHARS);

  const otherNames = input.tickerAliases.filter(
    (alias) =>
      alias !== input.tickerSymbol.toLowerCase() &&
      alias !== input.tickerName.toLowerCase(),
  );
  const aliasLine =
    otherNames.length > 0
      ? `This company is also referred to as: ${otherNames.join(", ")}. Treat any of these names as referring to the same company.`
      : null;

  const businessParts: string[] = [];
  if (input.businessActivity) {
    businessParts.push(`its main business is ${input.businessActivity}`);
  }
  if (input.subIndustry) {
    businessParts.push(`its sub-industry is ${input.subIndustry}`);
  }
  const businessLine =
    businessParts.length > 0
      ? `Context: ${businessParts.join(", ")}. Judge relevance against this actual business, not just a name match.`
      : null;

  const peerLine =
    input.peerNames && input.peerNames.length > 0
      ? `Known peers and competitors: ${input.peerNames.join(", ")}. Pages about these are relevant as competitive-landscape coverage.`
      : null;

  return [
    `Decide whether this web page is relevant for an investor tracking ${input.tickerSymbol} (${input.tickerName}) in ${industry}.`,
    "Relevant means the page is about this company, its industry, its peers and competitors, or events that materially affect it. Generic, unrelated, or spam pages are not relevant.",
    ...(businessLine ? [businessLine] : []),
    ...(aliasLine ? [aliasLine] : []),
    ...(peerLine ? [peerLine] : []),
    "",
    `Title: ${input.title}`,
    "",
    "Content (truncated):",
    head,
  ].join("\n");
};

/**
 * Judges page relevance with an LLM against the agent contract brief, falling back
 * to keyword/alias matching when the brief is missing or the LLM call fails.
 *
 * @param input - Page, ticker context, contract brief, and LLM credentials.
 */
export const judgeRelevance = async (
  input: JudgeRelevanceInput,
): Promise<RelevanceDecision> => {
  const brief = input.contractBrief?.trim();
  if (!brief) {
    return keywordFallback(input);
  }

  const generate = input.generate ?? generateObject;

  try {
    const openai = createOpenAI({
      apiKey: input.llm.apiKey,
      ...(input.llm.baseUrl ? { baseURL: input.llm.baseUrl } : {}),
    });

    const result = await generate({
      model: openai(input.llm.model),
      schema: relevanceResultSchema,
      system: `You are a strict relevance filter for an investment-research agent.\n\n<product_contract>\n${brief}\n</product_contract>`,
      prompt: buildPrompt(input),
      maxRetries: 0,
    });

    return result.object.relevant
      ? { keep: true, via: "llm" }
      : { keep: false, reason: "irrelevant", via: "llm" };
  } catch (error) {
    input.logger?.warn(
      { err: error },
      "LLM relevance judge failed; falling back to keyword matching",
    );

    return keywordFallback(input);
  }
};
