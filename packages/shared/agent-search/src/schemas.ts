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
  provider: z.enum(["serper", "tavily", "exa", "firecrawl"]),
  apiKey: z.string(),
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
 * A single search provider entry. API-key providers supply `{ provider, apiKey }`;
 * the self-hosted provider supplies `{ provider, baseUrl, headers }` instead.
 */
export const providerEntrySchema = z.discriminatedUnion("provider", [
  apiKeyProviderEntrySchema,
  selfHostedProviderEntrySchema,
]);

export type ProviderEntry = z.infer<typeof providerEntrySchema>;

/** Search localization used by provider adapters (Serper `gl`/`hl`; Exa ignores it). */
export const localeSchema = z.object({
  gl: z.string().describe("Search country code (Serper `gl`, Tavily country)."),
  hl: z.string().describe("Search language code (Serper `hl`)."),
});

export type SearchLocale = z.infer<typeof localeSchema>;
