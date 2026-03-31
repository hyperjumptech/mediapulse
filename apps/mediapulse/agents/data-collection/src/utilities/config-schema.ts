import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

const webSearchSchema = z.object({
  baseUrl: z.string(),
  authentication: z.object({
    type: z.enum(["bearer", "none"]),
    apiKey: z.string().optional(),
    headerName: z.string().optional(),
  }),
  rateLimit: z.object({
    requests: z.number(),
    perSeconds: z.number(),
  }),
  timeoutMs: z.number().int().positive().optional(),
  retry: z
    .object({
      maxAttempts: z.number().int().nonnegative(),
      baseDelayMs: z.number().int().positive(),
      maxDelayMs: z.number().int().positive(),
    })
    .optional(),
});

const webFetchSchema = z.object({
  baseUrl: z.string(),
  authentication: z.object({
    type: z.enum(["bearer", "none"]),
    apiKey: z.string().optional(),
    headerName: z.string().optional(),
  }),
  rateLimit: z.object({
    requests: z.number(),
    perSeconds: z.number(),
  }),
  timeoutMs: z.number().int().positive().optional(),
  retry: z
    .object({
      maxAttempts: z.number().int().nonnegative(),
      baseDelayMs: z.number().int().positive(),
      maxDelayMs: z.number().int().positive(),
    })
    .optional(),
});

/** Zod schema for agent config: web search/fetch providers, optional run policy. */
export const ConfigSchema = z.object({
  webSearch: webSearchSchema,
  webFetch: webFetchSchema,
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
