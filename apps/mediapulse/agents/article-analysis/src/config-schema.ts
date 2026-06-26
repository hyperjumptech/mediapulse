import {
  MEDIAPULSE_NEWSLETTER_SECTIONS,
  NEWSLETTER_SECTION_IDS,
} from "@workspace/agent-data-api-contract";
import { z } from "zod";

/** OpenAI-compatible LLM credentials used to classify articles into newsletter sections. */
const acceptanceSchema = z
  .object({
    model: z.string().default("{{AI_MODEL}}"),
    apiKey: z.string().default("{{AI_API_KEY}}"),
    baseUrl: z.string().default("{{AI_BASE_URL}}"),
  })
  .default({})
  .describe("LLM (OpenAI-compatible) credentials used to classify articles.");

const acceptanceCriteriaRuleSchema = z.object({
  section: z.enum(NEWSLETTER_SECTION_IDS as unknown as [string, ...string[]]),
  criteria: z
    .string()
    .trim()
    .min(1)
    .describe("What makes an article eligible for this section."),
});

/**
 * One acceptance rule per newsletter section. Defaults are seeded from the canonical sections'
 * descriptions; operators may override the criteria text per section.
 */
const acceptanceCriteriaSchema = z
  .array(acceptanceCriteriaRuleSchema)
  .default(() =>
    MEDIAPULSE_NEWSLETTER_SECTIONS.map((section) => ({
      section: section.id,
      criteria: section.description,
    })),
  )
  .describe(
    "One rule per newsletter section; seeded from the canonical 6, operator may override the text.",
  );

export const articleAnalysisConfigSchema = z
  .object({
    acceptance: acceptanceSchema,
    acceptanceCriteria: acceptanceCriteriaSchema,
  })
  .strict();

export type ArticleAnalysisConfig = z.output<
  typeof articleAnalysisConfigSchema
>;
export type AcceptanceCriteriaRule = z.output<
  typeof acceptanceCriteriaRuleSchema
>;
