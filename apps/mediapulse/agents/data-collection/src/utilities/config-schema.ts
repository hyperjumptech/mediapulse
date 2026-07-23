import {
  localeSchema,
  providerEntrySchema,
  providerNameSchema,
  type ProviderEntry,
  type ProviderName,
  type SearchLocale,
} from "@workspace/agent-search";
import { z } from "zod";

// Search provider identity, entry, and locale schemas are owned by
// @workspace/agent-search (shared with the query-analysis yield probe) and
// re-exported here so this agent's config surface is unchanged.
export { localeSchema, providerEntrySchema, providerNameSchema };
export type { ProviderName, ProviderEntry, SearchLocale };

/** Default round-robin pool used for web search (search-capable providers only). */
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
    "Web-search provider pool. Each request rotates the starting provider (round-robin) and falls back to the rest on failure.",
  );

const webSearchLocalesSchema = z
  .array(localeSchema)
  .min(1)
  .default([{ gl: "id", hl: "id" }])
  .describe(
    "Search localization. Each query fans out once per locale; results merge and dedup before fetch. Only Serper honors both fields: Firecrawl geo-targets on gl (country) and Exa on gl (userLocation), neither taking a search-language parameter, while Tavily ignores locale (its country param applies only to general, not news, search).",
  );

const collectionSchema = z
  .object({
    targetSavedSources: z
      .number()
      .int()
      .positive()
      .default(50)
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
        "Max random delay before a run starts searching, so concurrent ticker runs de-synchronize and avoid bursting the shared search-provider rate limit. 0 disables.",
      ),
  })
  .default({})
  .describe("Repeat-loop targets.");

/** Zod schema for agent config grouped for Hermes form sections. */
export const ConfigSchema = z.object({
  web_search: webSearchSchema,
  web_search_locales: webSearchLocalesSchema,
  collection: collectionSchema,
});

export type ConfigSchemaType = z.infer<typeof ConfigSchema>;

export type WebSearchConfig = ConfigSchemaType["web_search"];
