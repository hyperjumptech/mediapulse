import { z } from "zod";

/** Web providers that support search. Search adapters exist only for these. */
export const providerNameSchema = z.enum([
  "serper",
  "tavily",
  "exa",
  "firecrawl",
  "firecrawl_selfhosted",
]);

export type ProviderName = z.infer<typeof providerNameSchema>;

/** Providers with a fixed endpoint, authenticated with an API key. */
const apiKeyProviderEntrySchema = z.object({
  provider: z.enum(["serper", "tavily", "firecrawl"]),
  apiKey: z.string(),
});

/** Exa highlight extraction: a guiding query and a character cap on each returned passage. */
const exaHighlightsSchema = z.object({
  maxCharacters: z
    .number()
    .int()
    .positive()
    .describe("Max characters returned per Exa highlight passage."),
  query: z
    .string()
    .describe("Guiding query that steers which passages Exa highlights."),
});

export type ExaHighlights = z.infer<typeof exaHighlightsSchema>;

/** Exa entry: an API key plus optional Exa-only highlight settings. */
const exaProviderEntrySchema = z.object({
  provider: z.literal("exa"),
  apiKey: z.string(),
  highlights: exaHighlightsSchema
    .optional()
    .describe("Optional Exa highlight extraction settings."),
});

/** Self-hosted provider: a custom base URL plus operator-supplied auth headers. */
const selfHostedProviderEntrySchema = z.object({
  provider: z.literal("firecrawl_selfhosted"),
  baseUrl: z.string(),
  headers: z
    .record(z.string())
    .optional()
    .describe("Extra HTTP headers sent with every request."),
});

/**
 * A single search provider entry. Serper/Tavily/Firecrawl supply `{ provider, apiKey }`; Exa adds
 * Exa-only `highlights` settings; the self-hosted provider supplies `{ provider, baseUrl, headers }`.
 */
export const providerEntrySchema = z.discriminatedUnion("provider", [
  apiKeyProviderEntrySchema,
  exaProviderEntrySchema,
  selfHostedProviderEntrySchema,
]);

export type ProviderEntry = z.infer<typeof providerEntrySchema>;

/** Search localization used by provider adapters (Serper `gl`/`hl`, Firecrawl and Exa geo-target on `gl`). */
export const localeSchema = z.object({
  gl: z
    .string()
    .describe(
      "Search country code (Serper `gl`, Firecrawl `country`, Exa `userLocation`).",
    ),
  hl: z.string().describe("Search language code (Serper `hl`)."),
});

export type SearchLocale = z.infer<typeof localeSchema>;
