import { createOpenAI } from "@ai-sdk/openai";
import { generateObject, type ModelMessage } from "ai";
import {
  MEDIAPULSE_NEWSLETTER_SECTIONS,
  NEWSLETTER_SECTION_IDS,
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
 * Builds the chat messages for one article classification call.
 *
 * @param params - Article title/content and the acceptance criteria.
 * @returns System + user messages for `generateObject`.
 */
export const buildSectionClassificationMessages = (params: {
  title: string;
  content: string;
  acceptanceCriteria: AcceptanceCriteriaRule[];
}): ModelMessage[] => {
  const truncatedContent = params.content.slice(0, MAX_CONTENT_CHARS);
  const userContent = [
    "Newsletter sections and acceptance criteria:",
    renderCriteria(params.acceptanceCriteria),
    "",
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
    }),
  });

  return result.object;
};
