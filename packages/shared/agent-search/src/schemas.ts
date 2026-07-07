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

/**
 * A single search provider entry. Most providers only need a provider name and an
 * API key; `firecrawl_selfhosted` instead points at a custom `baseUrl` and
 * authenticates through operator-supplied `headers` (for example Cloudflare Access).
 */
export const providerEntrySchema = z
  .object({
    provider: providerNameSchema.describe("Provider identifier."),
    apiKey: z
      .string()
      .optional()
      .describe(
        "Provider API key or a Hermes variable placeholder such as {{SERPER_API_KEY}}. Optional for firecrawl_selfhosted, which authenticates via headers.",
      ),
    baseUrl: z
      .string()
      .optional()
      .describe(
        "Override base URL. Required for firecrawl_selfhosted; ignored by providers with fixed endpoints.",
      ),
    headers: z
      .record(z.string())
      .optional()
      .describe(
        "Extra HTTP headers sent with every request (for example Cloudflare Access). Used by firecrawl_selfhosted.",
      ),
  })
  .superRefine((entry, ctx) => {
    if (entry.provider === "firecrawl_selfhosted") {
      if (!entry.baseUrl) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["baseUrl"],
          message: "baseUrl is required for the firecrawl_selfhosted provider.",
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

export type ProviderEntry = z.infer<typeof providerEntrySchema>;

/** Search localization used by provider adapters (Serper `gl`/`hl`; Exa ignores it). */
export const localeSchema = z.object({
  gl: z.string().describe("Search country code (Serper `gl`, Tavily country)."),
  hl: z.string().describe("Search language code (Serper `hl`)."),
});

export type SearchLocale = z.infer<typeof localeSchema>;
