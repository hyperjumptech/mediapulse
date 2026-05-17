import type { JsonSchema } from "./types";

/**
 * Resolves the effective schema type (single type name) when schema.type is a string or array.
 */
export const getSchemaFormType = (schema: JsonSchema): JsonSchema["type"] => {
  const t = schema.type;
  if (Array.isArray(t)) return t[0];
  return t;
};

/**
 * Returns a default value for a schema (used to seed required keys).
 */
export const defaultForSchema = (schema: JsonSchema): unknown => {
  if (schema.default !== undefined) return schema.default;
  const type = getSchemaFormType(schema);
  if (type === "object") {
    const obj: Record<string, unknown> = {};
    if (schema.required?.length && schema.properties) {
      for (const key of schema.required) {
        const prop = schema.properties[key];
        if (prop) obj[key] = defaultForSchema(prop);
      }
    }
    return obj;
  }
  if (type === "array") return [];
  if (type === "string") {
    if (schema.enum != null && schema.enum.length > 0) return schema.enum[0];
    return "";
  }
  if (type === "number" || type === "integer") return 0;
  if (type === "boolean") return false;
  return undefined;
};

/**
 * Recursively merges value with empty defaults for any required keys that are missing.
 */
export const applyRequiredDefaults = (
  schema: JsonSchema,
  value: Record<string, unknown>,
): Record<string, unknown> => {
  if (!schema.properties || !schema.required?.length) return value;
  let changed = false;
  const result = { ...value };
  for (const key of schema.required) {
    const propSchema = schema.properties[key];
    if (!propSchema) continue;
    const existing = result[key];
    if (existing === undefined) {
      result[key] = defaultForSchema(propSchema);
      changed = true;
      continue;
    }
    const propType = getSchemaFormType(propSchema);
    if (
      propType === "object" &&
      propSchema.properties != null &&
      propSchema.required?.length != null &&
      typeof existing === "object" &&
      existing !== null &&
      !Array.isArray(existing)
    ) {
      const nested = applyRequiredDefaults(
        propSchema,
        existing as Record<string, unknown>,
      );
      if (nested !== existing) {
        result[key] = nested;
        changed = true;
      }
    }
  }
  return changed ? result : value;
};
