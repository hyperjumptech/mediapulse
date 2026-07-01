import { createOpenAI } from "@ai-sdk/openai";
import { generateObject, type ModelMessage } from "ai";
import { extractLlmUsage, type OnLlmUsage } from "@workspace/agent-runtime";
import {
  MEDIAPULSE_NEWSLETTER_SECTIONS,
  NEWSLETTER_SECTION_IDS,
  type AnalysisTickerContext,
} from "@workspace/agent-data-api-contract";
import { z } from "zod";

import type { AcceptanceCriteriaRule } from "./config-schema.js";

/** Article content past this many characters is truncated before classification. */
export const MAX_CONTENT_CHARS = 12000;

/**
 * LLM output: the single best-fit newsletter section (or `null` to reject), a 0–1 fit score,
 * and a short reason explaining the choice or the rejection.
 */
export const articleSectionClassificationSchema = z.object({
  section: z
    .enum(NEWSLETTER_SECTION_IDS as unknown as [string, ...string[]])
    .nullable(),
  score: z.number().min(0).max(1),
  reason: z.string().trim().min(1).max(2000),
});

export type ArticleSectionClassification = z.infer<
  typeof articleSectionClassificationSchema
>;

const SYSTEM_PROMPT = [
  "You are an editorial classifier for an industry newsletter.",
  "Assign each article to EXACTLY ONE newsletter section using the acceptance criteria provided,",
  "or reject it (section = null) when it fits none of them.",
  "Return a fit score between 0 and 1 and a one-sentence reason explaining why the article was",
  "placed in that section, or — when rejected — why it does not fit any section.",
].join(" ");

/**
 * Renders the acceptance criteria (with each section's human label) into a prompt block.
 *
 * @param acceptanceCriteria - Per-section rules from agent config.
 * @returns A newline-delimited list of `id (Label): criteria`.
 */
const renderCriteria = (
  acceptanceCriteria: AcceptanceCriteriaRule[],
): string => {
  const labelById = new Map<string, string>(
    MEDIAPULSE_NEWSLETTER_SECTIONS.map((section) => [
      section.id,
      section.label,
    ]),
  );

  return acceptanceCriteria
    .map((rule) => {
      const label = labelById.get(rule.section) ?? rule.section;
      return `- ${rule.section} (${label}): ${rule.criteria}`;
    })
    .join("\n");
};

/**
 * Renders the issuer the article was collected for into a one-line prompt block.
 *
 * @param ticker - Per-article ticker context from `analysis.get`, or `null` when ticker-agnostic.
 * @returns A single context line, or `null` when there is no issuer to describe.
 */
export const renderArticleTickerContext = (
  ticker: AnalysisTickerContext | null,
): string | null => {
  if (ticker === null) {
    return null;
  }

  const descriptors: string[] = [];
  if (ticker.sector) {
    descriptors.push(`sector ${ticker.sector}`);
  }
  if (ticker.industry) {
    descriptors.push(`industry ${ticker.industry}`);
  }
  if (ticker.subIndustry) {
    descriptors.push(`sub-industry ${ticker.subIndustry}`);
  }
  if (ticker.businessActivity) {
    descriptors.push(`main business ${ticker.businessActivity}`);
  }
  const descriptorText =
    descriptors.length > 0 ? ` — ${descriptors.join(", ")}` : "";

  return `Issuer context: this article was collected for ${ticker.symbol} (${ticker.name})${descriptorText}. Newsletter sections are defined relative to this issuer and its industry.`;
};

/**
 * Builds the chat messages for one article classification call.
 *
 * @param params - Article title/content, the acceptance criteria, and optional issuer context.
 * @returns System + user messages for `generateObject`.
 */
export const buildSectionClassificationMessages = (params: {
  title: string;
  content: string;
  acceptanceCriteria: AcceptanceCriteriaRule[];
  tickerContext?: string;
}): ModelMessage[] => {
  const truncatedContent = params.content.slice(0, MAX_CONTENT_CHARS);
  const userContent = [
    "Newsletter sections and acceptance criteria:",
    renderCriteria(params.acceptanceCriteria),
    "",
    ...(params.tickerContext ? [params.tickerContext, ""] : []),
    `Article title: ${params.title}`,
    "",
    "Article content:",
    truncatedContent,
  ].join("\n");

  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userContent },
  ];
};

/**
 * Classifies a single article into one newsletter section (or rejects it) with a score and reason.
 *
 * @param params - LLM credentials, the article, and the acceptance criteria.
 * @returns The validated classification.
 */
export const classifyArticleSection = async (params: {
  apiKey: string;
  baseUrl: string;
  model: string;
  title: string;
  content: string;
  acceptanceCriteria: AcceptanceCriteriaRule[];
  tickerContext?: string;
  /** Chronicle instrumentation: invoked with token usage per classification. */
  onUsage?: OnLlmUsage;
}): Promise<ArticleSectionClassification> => {
  const openai = createOpenAI({
    apiKey: params.apiKey,
    baseURL: params.baseUrl,
  });

  const result = await generateObject({
    model: openai(params.model),
    schema: articleSectionClassificationSchema,
    messages: buildSectionClassificationMessages({
      title: params.title,
      content: params.content,
      acceptanceCriteria: params.acceptanceCriteria,
      tickerContext: params.tickerContext,
    }),
  });
  const usage = extractLlmUsage(result.usage);
  if (usage !== undefined) {
    params.onUsage?.(usage);
  }

  return result.object;
};
