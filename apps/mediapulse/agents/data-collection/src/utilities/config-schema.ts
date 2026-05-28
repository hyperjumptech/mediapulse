import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

const concurrencySchema = z.number().int().min(1).max(16).default(4);

const webSearchSchema = z.object({
  baseUrl: z.string(),
  authentication: z.object({
    type: z.enum(["bearer", "none"]),
    apiKey: z.string().optional(),
    headerName: z.string().optional(),
  }),
  rateLimit: z.object({
    requests: z.number().int().positive(),
    perSeconds: z.number().positive(),
  }),
  concurrency: concurrencySchema,
  timeoutMs: z.number().int().positive().optional(),
  retry: z
    .object({
      maxAttempts: z.number().int().nonnegative(),
      baseDelayMs: z.number().int().positive(),
      maxDelayMs: z.number().int().positive(),
    })
    .optional(),
});

const fetchProviderAuthenticationSchema = z.object({
  type: z.enum(["bearer", "none"]),
  apiKey: z.string().optional(),
  headerName: z.string().optional(),
});

const fetchProviderRateLimitSchema = z.object({
  requests: z.number().int().positive(),
  perSeconds: z.number().positive(),
});

const fetchProviderRetrySchema = z
  .object({
    maxAttempts: z.number().int().nonnegative(),
    baseDelayMs: z.number().int().positive(),
    maxDelayMs: z.number().int().positive(),
  })
  .optional();

export const fetchProviderConfigSchema = z.object({
  type: z.string(),
  baseUrl: z.string(),
  authentication: fetchProviderAuthenticationSchema,
  rateLimit: fetchProviderRateLimitSchema,
  concurrency: concurrencySchema,
  timeoutMs: z.number().int().positive().optional(),
  retry: fetchProviderRetrySchema,
});

const webFetchSchema = z.object({
  providers: z.array(fetchProviderConfigSchema).min(1),
});

const relevanceGateSchema = z.object({
  enabled: z.boolean().default(true),
  headChars: z.number().int().positive().default(1500),
  minMatches: z.number().int().positive().default(1),
});

const freshnessGateSchema = z.object({
  enabled: z.boolean().default(true),
  maxAgeDays: z.number().int().positive().default(14),
  allowUnknown: z.boolean().default(true),
});

/** Zod schema for agent config: web search/fetch providers, optional run policy. */
export const ConfigSchema = z.object({
  webSearch: webSearchSchema,
  webFetch: webFetchSchema,
  targetDailySuccessfulSources: z.number().int().positive().optional(),
  maxRefillRounds: z.number().int().nonnegative().optional(),
  relevanceGate: relevanceGateSchema.optional(),
  freshnessGate: freshnessGateSchema.optional(),
  perQueryFetchBudget: z.number().int().positive().default(3),
  perRunFetchBudget: z.number().int().positive().default(40),
  deadUrlCache: z
    .object({
      enabled: z.boolean().default(true),
      skipLookupBatchSize: z.number().int().positive().default(50),
    })
    .optional(),
  hostErrorBreaker: z
    .object({
      enabled: z.boolean().default(true),
      minAttempts: z.number().int().positive().default(5),
      errorRateThreshold: z.number().min(0).max(1).default(0.5),
    })
    .optional(),
  semanticDedupe: z
    .object({
      enabled: z.boolean().default(false),
      threshold: z.number().min(0).max(1).default(0.88),
      windowDays: z.number().int().positive().default(7),
      embeddingModel: z.string().default("text-embedding-3-small"),
    })
    .optional(),
  /**
   * OpenAI API key for semantic dedupe embeddings (Hermes config / variable expansion).
   * Not read from process env — same pattern as query-analysis.
   */
  openaiApiKey: z.string().min(1).optional(),
  runPolicy: z
    .object({
      minSuccessfulSources: z.number().int().nonnegative(),
      failOnZeroSuccess: z.boolean(),
    })
    .optional(),
});

export const dataCollectionAgentConfigSchema = ConfigSchema;

export type ConfigSchemaType = z.infer<typeof ConfigSchema>;

/**
 * Minimal JSON Schema type used for the /config response.
 * This is intentionally loose to avoid over-constraining the runtime representation.
 */
export type JsonSchema = {
  [key: string]: unknown;
};

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
