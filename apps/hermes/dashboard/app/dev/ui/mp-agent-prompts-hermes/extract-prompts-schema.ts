import type { JsonSchema } from "@workspace/json-schema-form";

/**
 * Returns true when `schema.type` is the string `"object"` (or includes it in a union).
 */
const isObjectSchema = (schema: JsonSchema): boolean => {
  const type = schema.type;
  if (type === "object") return true;
  if (Array.isArray(type)) return type.includes("object");
  return false;
};

/**
 * Extracts the nested `prompts` object schema from an agent config JSON Schema.
 *
 * @param schema - Full agent config schema exported for Hermes.
 * @returns The `prompts` sub-schema, or `undefined` when absent or not an object.
 */
export const extractPromptsSchema = (
  schema: JsonSchema,
): JsonSchema | undefined => {
  const prompts = schema.properties?.prompts;
  if (prompts == null || !isObjectSchema(prompts) || !prompts.properties) {
    return undefined;
  }
  return prompts;
};
