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
 * Recursively collects only explicitly declared schema defaults.
 * Returns undefined when no default is declared anywhere in the subtree.
 */
export const collectSchemaDefaults = (
  schema: JsonSchema,
): unknown | undefined => {
  const type = getSchemaFormType(schema);

  if (type === "object" && schema.properties) {
    let obj: Record<string, unknown> | undefined;

    if (schema.default !== undefined) {
      if (
        typeof schema.default === "object" &&
        schema.default !== null &&
        !Array.isArray(schema.default)
      ) {
        obj = { ...(schema.default as Record<string, unknown>) };
      } else {
        return schema.default;
      }
    }

    for (const [key, propSchema] of Object.entries(schema.properties)) {
      const propDefault = collectSchemaDefaults(propSchema);
      if (propDefault !== undefined) {
        if (!obj) obj = {};
        obj[key] = propDefault;
      }
    }

    return obj;
  }

  if (schema.default !== undefined) {
    return schema.default;
  }

  return undefined;
};

/**
 * Recursively merges value with declared schema defaults and required type-zero seeds.
 */
export const applySchemaDefaults = (
  schema: JsonSchema,
  value: Record<string, unknown>,
): Record<string, unknown> => {
  if (!schema.properties) return value;

  const requiredSet = new Set(schema.required ?? []);
  let changed = false;
  const result = { ...value };

  for (const [key, propSchema] of Object.entries(schema.properties)) {
    const existing = result[key];
    const declaredDefault = collectSchemaDefaults(propSchema);

    if (existing === undefined) {
      if (declaredDefault !== undefined) {
        result[key] = declaredDefault;
        changed = true;
      } else if (requiredSet.has(key)) {
        result[key] = defaultForSchema(propSchema);
        changed = true;
      }
      continue;
    }

    const propType = getSchemaFormType(propSchema);
    if (
      propType === "object" &&
      propSchema.properties != null &&
      typeof existing === "object" &&
      existing !== null &&
      !Array.isArray(existing)
    ) {
      const nested = applySchemaDefaults(
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
