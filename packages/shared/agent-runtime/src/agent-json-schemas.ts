import { keepZodV3JsonSchemaShape } from "@hermes/domain-contract/form-json-schema";
import { z } from "zod";

import { enrichConfigSchemaForHermesUi } from "./enrich-config-schema-for-hermes-ui.js";

type JsonSchemaRecord = Record<string, unknown>;

export const toAgentJsonSchema = (schema: z.ZodType): JsonSchemaRecord =>
  z.toJSONSchema(schema, {
    target: "draft-7",
    io: "input",
    unrepresentable: "any",
    override: keepZodV3JsonSchemaShape as never,
  }) as JsonSchemaRecord;

export const buildAgentJsonSchemas = (
  inputSchema: z.ZodType,
  configSchema: z.ZodType,
): { inputSchema: JsonSchemaRecord; configSchema: JsonSchemaRecord } => ({
  inputSchema: toAgentJsonSchema(inputSchema),
  configSchema: enrichConfigSchemaForHermesUi(toAgentJsonSchema(configSchema)),
});
