import {
  localeSchema,
  providerEntrySchema,
  providerNameSchema,
  type ProviderEntry,
  type ProviderName,
  type SearchLocale,
} from "@workspace/agent-search";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

// Search provider identity, entry, and locale schemas are owned by
// @workspace/agent-search (shared with the query-analysis yield probe) and
// re-exported here so this agent's config surface is unchanged.
export { localeSchema, providerEntrySchema, providerNameSchema };
export type { ProviderName, ProviderEntry, SearchLocale };

/** Web providers usable for fetch. Diffbot, Firecrawl, and Jina are fetch-only. */
export const fetchProviderNameSchema = z.enum([
  "serper",
  "tavily",
  "exa",
  "diffbot",
  "firecrawl",
  "firecrawl_selfhosted",
  "jina",
]);

export type FetchProviderName = z.infer<typeof fetchProviderNameSchema>;

/**
 * A single fetch provider entry. Most providers only need a provider name and an
 * API key; some instead point at a custom `baseUrl` and authenticate through
 * operator-supplied `headers`.
 */
const fetchProviderEntrySchema = z
  .object({
    provider: fetchProviderNameSchema.describe("Fetch provider identifier."),
    apiKey: z
      .string()
      .optional()
      .describe(
        "Provider API key or a Hermes variable placeholder such as {{SERPER_API_KEY}}. Optional for providers that authenticate via custom headers.",
      ),
    baseUrl: z
      .string()
      .optional()
      .describe(
        "Override base URL. Required for providers that target a custom endpoint; ignored by providers with fixed endpoints.",
      ),
    headers: z
      .record(z.string())
      .optional()
      .describe(
        "Extra HTTP headers sent with every request. Used by providers that authenticate via custom headers.",
      ),
  })
  .superRefine((entry, ctx) => {
    if (entry.provider === "firecrawl_selfhosted") {
      if (!entry.baseUrl) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["baseUrl"],
          message: "baseUrl is required for this provider.",
        });
      }
    } else if (!entry.apiKey) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["apiKey"],
        message: `apiKey is required for the ${entry.provider} provider.`,
      });
    }
  });

export type FetchProviderEntry = z.infer<typeof fetchProviderEntrySchema>;

/** Default round-robin pool used for web search (search-capable providers only). */
const defaultProviderPool: ProviderEntry[] = [
  { provider: "serper", apiKey: "{{SERPER_API_KEY}}" },
  { provider: "tavily", apiKey: "{{TAVILY_API_KEY}}" },
  { provider: "exa", apiKey: "{{EXA_API_KEY}}" },
];

/** Default round-robin pool used for web fetch, including the fetch-only providers. */
const defaultFetchProviderPool: FetchProviderEntry[] = [
  { provider: "serper", apiKey: "{{SERPER_API_KEY}}" },
  { provider: "tavily", apiKey: "{{TAVILY_API_KEY}}" },
  { provider: "exa", apiKey: "{{EXA_API_KEY}}" },
  { provider: "diffbot", apiKey: "{{DIFFBOT_API_KEY}}" },
  { provider: "firecrawl", apiKey: "{{FIRECRAWL_API_KEY}}" },
  { provider: "jina", apiKey: "{{JINA_API_KEY}}" },
];

const webSearchSchema = z
  .array(providerEntrySchema)
  .min(1)
  .default([...defaultProviderPool])
  .describe(
    "Web-search provider pool. Each request rotates the starting provider (round-robin) and falls back to the rest on failure.",
  );

const webFetchSchema = z
  .array(fetchProviderEntrySchema)
  .min(1)
  .default([...defaultFetchProviderPool])
  .describe(
    "Web-fetch provider pool. Each request rotates the starting provider (round-robin) and falls back to the rest on failure.",
  );

const webSearchLocalesSchema = z
  .array(localeSchema)
  .min(1)
  .default([{ gl: "id", hl: "id" }])
  .describe(
    "Search localization. Each query fans out once per locale; results merge and dedup before fetch. Exa ignores locale.",
  );

const relevanceSchema = z
  .object({
    apiKey: z
      .string()
      .default("{{AI_API_KEY}}")
      .describe("OpenAI-compatible API key for the LLM relevance filter."),
    model: z
      .string()
      .default("{{AI_MODEL}}")
      .describe("Model id for the LLM relevance filter."),
    baseUrl: z
      .string()
      .default("{{AI_BASE_URL}}")
      .describe(
        "OpenAI-compatible base URL (for example an OpenRouter gateway).",
      ),
  })
  .default({})
  .describe("LLM relevance filter credentials (always-on gate).");

export type RelevanceConfig = z.infer<typeof relevanceSchema>;

const collectionSchema = z
  .object({
    targetSavedSources: z
      .number()
      .int()
      .positive()
      .default(15)
      .describe(
        "Stop the repeat loop once this many successful sources exist for the ticker today (UTC).",
      ),
    maxRounds: z
      .number()
      .int()
      .positive()
      .default(3)
      .describe("Hard cap on search-fetch-filter-save rounds per run."),
    startupJitterMs: z
      .number()
      .int()
      .nonnegative()
      .default(30_000)
      .describe(
        "Max random delay before a run starts fetching, so concurrent ticker runs de-synchronize and avoid bursting the shared fetch-provider rate limit. 0 disables.",
      ),
  })
  .default({})
  .describe("Repeat-loop targets.");

/** Zod schema for agent config grouped for Hermes form sections. */
export const ConfigSchema = z.object({
  web_search: webSearchSchema,
  web_search_locales: webSearchLocalesSchema,
  web_fetch: webFetchSchema,
  relevance: relevanceSchema,
  collection: collectionSchema,
});

export const dataCollectionAgentConfigSchema = ConfigSchema;

export type ConfigSchemaType = z.infer<typeof ConfigSchema>;

export type WebSearchConfig = ConfigSchemaType["web_search"];
export type WebFetchConfig = ConfigSchemaType["web_fetch"];
export type CollectionConfig = ConfigSchemaType["collection"];

/**
 * Minimal JSON Schema type used for the /config response.
 * This is intentionally loose to avoid over-constraining the runtime representation.
 */
export type JsonSchema = {
  [key: string]: unknown;
};

/**
 * Returns whether a config value is an unresolved Hermes variable placeholder.
 *
 * @param value - Config string that may still contain `{{NAME}}` syntax.
 */
export const isUnresolvedVariablePlaceholder = (value: string): boolean =>
  /^\{\{[A-Z0-9_]+\}\}$/.test(value);

/**
 * Returns the JSON Schema representation of the config schema wrapped with the agent ID.
 */
export function getConfigSchema(): {
  agentId: "data-collection";
  schema: JsonSchema;
} {
  const schema = zodToJsonSchema(ConfigSchema) as JsonSchema;

  return {
    agentId: "data-collection",
    schema,
  };
}
