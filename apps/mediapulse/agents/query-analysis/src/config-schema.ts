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
  .default([...defaultProviderPool])
  .describe(
    "Web-search provider pool for the yield probe. Each probe rotates the starting provider (round-robin) and falls back to the rest on failure.",
  );

const aiSchema = z
  .object({
    apiKey: z
      .string()
      .default("{{AI_API_KEY}}")
      .describe(
        "OpenAI-compatible API key for entity discovery (or a Hermes variable placeholder such as {{AI_API_KEY}}).",
      ),
    model: z
      .string()
      .default("{{AI_MODEL}}")
      .describe(
        "Model id used for entity discovery (or a Hermes variable placeholder such as {{AI_MODEL}}).",
      ),
    baseUrl: z
      .string()
      .default("{{AI_BASE_URL}}")
      .describe(
        "OpenAI-compatible base URL for entity discovery (for example an OpenRouter gateway).",
      ),
  })
  .default({})
  .describe("LLM credentials for the entity-discovery step.");

/**
 * Runtime configuration from Hermes invoke `config` (variable substitution).
 *
 * The self-driving pipeline exposes only two operator groups (`web_search` and
 * `ai`), matching data-collection. Every other knob (languages, probe locales,
 * query count, discovery caps, probe budget, cache TTL, market anchors) is an
 * internal constant in `./constants`, not operator-tunable config.
 */
export const queryAnalysisConfigSchema = z
  .object({
    web_search: webSearchSchema,
    ai: aiSchema,
  })
  .strict();

/** Parsed invoke config with all group and field defaults applied. */
export type QueryAnalysisConfig = z.output<typeof queryAnalysisConfigSchema>;

/** LLM credentials group used by the discovery step. */
export type QueryAnalysisAiConfig = QueryAnalysisConfig["ai"];

/** Web-search provider pool used by the yield probe. */
export type QueryAnalysisWebSearchConfig = QueryAnalysisConfig["web_search"];
