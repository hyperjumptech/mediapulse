import { z } from "zod";

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
  webSearch: z.record(z.string(), webSearchSchema),
  webFetch: z.record(z.string(), webFetchSchema),
});

export type DataCollectionAgentConfig = z.infer<typeof ConfigSchema>;

/**
 * Minimal JSON Schema type used for the /config response.
 * This is intentionally loose to avoid over-constraining the runtime representation.
 */
export type JsonSchema = {
  [key: string]: unknown;
};

/** Zod v4 adds toJSONSchema; type is narrowed so TS accepts it when multiple zod versions exist in the workspace. */
const zWithJSONSchema = z as typeof z & {
  toJSONSchema: (
    schema: z.ZodTypeAny,
    options?: { unrepresentable?: "any" },
  ) => Record<string, unknown>;
};

export function getConfigSchema(): {
  agentId: "data-collection";
  schema: JsonSchema;
} {
  const schema = zWithJSONSchema.toJSONSchema(ConfigSchema, {
    unrepresentable: "any",
  }) as JsonSchema;

  return {
    agentId: "data-collection",
    schema,
  };
}
