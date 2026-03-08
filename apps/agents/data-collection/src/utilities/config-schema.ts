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
});

export const ConfigSchema = z.object({
  webSearch: webSearchSchema,
  webFetch: webFetchSchema,
});

export const dataCollectionAgentConfigSchema = ConfigSchema;

export type DataCollectionAgentConfig = z.infer<typeof ConfigSchema>;

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
