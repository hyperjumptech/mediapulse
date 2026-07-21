import {
  providerEntrySchema,
  type ProviderEntry,
} from "@workspace/agent-search";
import { z } from "zod";

/** Default round-robin pool used for the yield probe (search-capable providers only). */
const defaultProviderPool: ProviderEntry[] = [
  { provider: "serper", apiKey: "{{SERPER_API_KEY}}" },
  { provider: "tavily", apiKey: "{{TAVILY_API_KEY}}" },
  { provider: "exa", apiKey: "{{EXA_API_KEY}}" },
];

const webSearchSchema = z
  .array(providerEntrySchema)
  .min(1)
  .default([...defaultProviderPool]);

const languageModelSchema = z
  .object({
    baseUrl: z
      .string()
      .default("{{AI_BASE_URL}}")
      .describe("OpenAI-compatible base URL"),
    model: z.string().default("{{AI_MODEL}}"),
    apiKey: z.string().default("{{AI_API_KEY}}"),
  })
  .default({})
  .describe(
    "LLM used to discover related entities and generate the search-query candidates.",
  );

const generationSchema = z
  .object({
    queriesPerIntent: z
      .number()
      .int()
      .positive()
      .max(20)
      .default(5)
      .describe(
        "Queries persisted per intent. Every intent is filled to this number, so the active query set holds this many times the intent count.",
      ),
  })
  .default({})
  .describe("Per-intent query budget.");

/**
 * Runtime configuration from Hermes invoke `config` (variable substitution).
 *
 * Operator groups are `web_search`, `language_model`, and `generation`. The
 * remaining knobs (languages, probe locales, discovery caps, probe budget,
 * cache TTL, market anchors) are internal constants in `./constants`.
 */
export const queryAnalysisConfigSchema = z
  .object({
    language_model: languageModelSchema,
    web_search: webSearchSchema,
    generation: generationSchema,
  })
  .strict();

/** Parsed invoke config with all group and field defaults applied. */
export type QueryAnalysisConfig = z.output<typeof queryAnalysisConfigSchema>;

/** LLM credentials group used for entity discovery and query generation. */
export type QueryAnalysisAiConfig = QueryAnalysisConfig["language_model"];

/** Web-search provider pool used by the yield probe. */
export type QueryAnalysisWebSearchConfig = QueryAnalysisConfig["web_search"];

/** Per-intent query budget group. */
export type QueryAnalysisGenerationConfig = QueryAnalysisConfig["generation"];
