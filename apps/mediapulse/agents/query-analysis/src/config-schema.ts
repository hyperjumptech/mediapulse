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

/**
 * Runtime configuration from Hermes invoke `config` (variable substitution).
 *
 * The self-driving pipeline exposes only two operator groups (`web_search` and
 * `language_model`). Every other knob (languages, probe locales, query count,
 * discovery caps, probe budget, cache TTL, market anchors) is an internal
 * constant in `./constants`, not operator-tunable config.
 */
export const queryAnalysisConfigSchema = z
  .object({
    language_model: languageModelSchema,
    web_search: webSearchSchema,
  })
  .strict();

/** Parsed invoke config with all group and field defaults applied. */
export type QueryAnalysisConfig = z.output<typeof queryAnalysisConfigSchema>;

/** LLM credentials group used for entity discovery and query generation. */
export type QueryAnalysisAiConfig = QueryAnalysisConfig["language_model"];

/** Web-search provider pool used by the yield probe. */
export type QueryAnalysisWebSearchConfig = QueryAnalysisConfig["web_search"];
