import { z } from "zod";

/** Web providers that support search. Search adapters exist only for these. */
export const providerNameSchema = z.enum(["serper", "tavily", "exa"]);

export type ProviderName = z.infer<typeof providerNameSchema>;

/** A single search provider entry: the operator only picks a provider and pastes an API key. */
export const providerEntrySchema = z.object({
  provider: providerNameSchema.describe("Provider identifier."),
  apiKey: z
    .string()
    .describe(
      "Provider API key or a Hermes variable placeholder such as {{SERPER_API_KEY}}.",
    ),
});

export type ProviderEntry = z.infer<typeof providerEntrySchema>;

/** Search localization used by provider adapters (Serper `gl`/`hl`; Exa ignores it). */
export const localeSchema = z.object({
  gl: z.string().describe("Search country code (Serper `gl`, Tavily country)."),
  hl: z.string().describe("Search language code (Serper `hl`)."),
});

export type SearchLocale = z.infer<typeof localeSchema>;
