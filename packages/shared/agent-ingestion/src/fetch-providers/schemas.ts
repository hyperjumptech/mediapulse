import { z } from "zod";

import type { FetchProviderConfig } from "./types";

/** Web providers that support page fetching. Fetch adapters exist only for these. */
export const fetchProviderNameSchema = z.enum([
  "serper",
  "jina",
  "firecrawl",
  "firecrawl_selfhosted",
  "diffbot",
  "tavily",
  "exa",
]);

export type FetchProviderName = z.infer<typeof fetchProviderNameSchema>;

const rateLimitOverrideSchema = z
  .object({
    requests: z
      .number()
      .int()
      .positive()
      .describe("Maximum requests allowed within the sliding window."),
    perSeconds: z
      .number()
      .positive()
      .describe("Sliding window length in seconds for rate limiting."),
  })
  .describe("Optional sliding-window request budget override.");

const timeoutOverrideSchema = z
  .number()
  .int()
  .positive()
  .describe("Optional per-request timeout override in milliseconds.");

/** Providers with a fixed endpoint, authenticated with an API key. */
const apiKeyFetchProviderEntrySchema = z.object({
  provider: z.enum(["serper", "jina", "firecrawl", "diffbot", "tavily", "exa"]),
  apiKey: z
    .string()
    .describe(
      "Provider API key or a Hermes variable placeholder such as {{SERPER_API_KEY}}.",
    ),
  rateLimit: rateLimitOverrideSchema.optional(),
  timeoutMs: timeoutOverrideSchema.optional(),
});

/** Self-hosted provider: a custom base URL plus operator-supplied auth headers. */
const selfHostedFetchProviderEntrySchema = z.object({
  provider: z.literal("firecrawl_selfhosted"),
  baseUrl: z.string().describe("Base URL of the self-hosted Firecrawl."),
  headers: z
    .record(z.string())
    .optional()
    .describe("Extra HTTP headers sent with every request."),
  rateLimit: rateLimitOverrideSchema.optional(),
  timeoutMs: timeoutOverrideSchema.optional(),
});

const fetchProviderEntryUnionSchema = z.discriminatedUnion("provider", [
  apiKeyFetchProviderEntrySchema,
  selfHostedFetchProviderEntrySchema,
]);

type LegacyFetchProviderEntry = {
  type?: unknown;
  baseUrl?: unknown;
  authentication?: { apiKey?: unknown } | null;
  headers?: unknown;
  rateLimit?: unknown;
  timeoutMs?: unknown;
};

const isLegacyFetchProviderEntry = (
  value: unknown,
): value is LegacyFetchProviderEntry =>
  typeof value === "object" &&
  value !== null &&
  !("provider" in value) &&
  typeof (value as LegacyFetchProviderEntry).type === "string";

/**
 * Rewrites a stored pre-dropdown entry into the discriminated-union shape.
 *
 * @param value - Raw entry from stored Hermes config.
 * @returns The entry in the current shape, or `value` untouched when it already is.
 */
const normalizeLegacyFetchProviderEntry = (value: unknown): unknown => {
  if (!isLegacyFetchProviderEntry(value)) {
    return value;
  }

  const provider = value.type;
  const overrides = {
    ...(value.rateLimit ? { rateLimit: value.rateLimit } : {}),
    ...(value.timeoutMs ? { timeoutMs: value.timeoutMs } : {}),
  };

  if (provider === "firecrawl_selfhosted") {
    return {
      provider,
      baseUrl: value.baseUrl,
      ...(value.headers ? { headers: value.headers } : {}),
      ...overrides,
    };
  }

  return {
    provider,
    apiKey: value.authentication?.apiKey,
    ...overrides,
  };
};

/**
 * A single fetch provider entry. API-key providers supply `{ provider, apiKey }`;
 * the self-hosted provider supplies `{ provider, baseUrl, headers }` instead. Both
 * accept optional `rateLimit` and `timeoutMs` overrides.
 *
 * Entries stored before the dropdown migration (`{ type, baseUrl, authentication }`)
 * are normalized in a preprocess step, which leaves the published JSON schema
 * identical to the bare union so Hermes still renders the provider dropdown.
 */
export const fetchProviderEntrySchema = z.preprocess(
  normalizeLegacyFetchProviderEntry,
  fetchProviderEntryUnionSchema,
);

export type FetchProviderEntry = z.infer<typeof fetchProviderEntrySchema>;

const defaultRetry = {
  maxAttempts: 1,
  baseDelayMs: 1000,
  maxDelayMs: 10_000,
} as const;

const defaultRateLimit = { requests: 1, perSeconds: 1 } as const;

const defaultConcurrency = 1;

const defaultTimeoutMs = 45_000;

type FetchProviderDefaults = {
  baseUrl: string;
  authentication: FetchProviderConfig["authentication"];
};

const fetchProviderDefaults: Record<
  Exclude<FetchProviderName, "firecrawl_selfhosted">,
  FetchProviderDefaults
> = {
  serper: {
    baseUrl: "https://scrape.serper.dev",
    authentication: { type: "none", headerName: "X-API-KEY" },
  },
  jina: {
    baseUrl: "https://r.jina.ai/",
    authentication: { type: "bearer", headerName: "Authorization" },
  },
  firecrawl: {
    baseUrl: "https://api.firecrawl.dev",
    authentication: { type: "bearer" },
  },
  diffbot: {
    baseUrl: "https://api.diffbot.com",
    authentication: { type: "none" },
  },
  tavily: {
    baseUrl: "https://api.tavily.com/extract",
    authentication: { type: "bearer" },
  },
  exa: {
    baseUrl: "https://api.exa.ai/contents",
    authentication: { type: "none" },
  },
};

/**
 * Expands a validated entry into the runtime config consumed by `createFetchProvider`.
 *
 * @param entry - Validated provider entry.
 * @returns Runtime fetch provider configuration with per-provider defaults applied.
 */
export const expandFetchProviderEntry = (
  entry: FetchProviderEntry,
): FetchProviderConfig => {
  const shared = {
    rateLimit: entry.rateLimit ?? defaultRateLimit,
    concurrency: defaultConcurrency,
    timeoutMs: entry.timeoutMs ?? defaultTimeoutMs,
    retry: defaultRetry,
  };

  if (entry.provider === "firecrawl_selfhosted") {
    return {
      type: entry.provider,
      baseUrl: entry.baseUrl,
      authentication: { type: "none" },
      ...(entry.headers ? { headers: entry.headers } : {}),
      ...shared,
    };
  }

  const defaults = fetchProviderDefaults[entry.provider];

  return {
    type: entry.provider,
    baseUrl: defaults.baseUrl,
    authentication: { ...defaults.authentication, apiKey: entry.apiKey },
    ...shared,
  };
};

/**
 * Expands an ordered list of entries into the runtime provider chain config.
 *
 * @param entries - Ordered provider entries; index 0 is the primary provider.
 */
export const expandFetchProviderEntries = (
  entries: readonly FetchProviderEntry[],
): FetchProviderConfig[] => entries.map(expandFetchProviderEntry);
