type JsonSchemaNode = {
  type?: string | string[];
  properties?: Record<string, JsonSchemaNode>;
  additionalProperties?: boolean | JsonSchemaNode;
  items?: JsonSchemaNode | JsonSchemaNode[];
};

/**
 * Resolves the primary JSON Schema type name when `type` is a string or array.
 *
 * @param schema - Schema node.
 * @returns Primary type string, if any.
 */
const schemaType = (schema: JsonSchemaNode): string | undefined => {
  const raw = schema.type;
  if (Array.isArray(raw)) {
    return raw[0];
  }
  return raw;
};

/**
 * Strips a value to the shape described by a JSON Schema node (recursive for objects).
 *
 * @param schema - JSON Schema node.
 * @param value - Raw config fragment.
 * @returns Coerced value, or `undefined` when the value cannot be placed in the schema.
 */
const stripValueToSchema = (
  schema: JsonSchemaNode,
  value: unknown,
): unknown => {
  const type = schemaType(schema);

  if (type === "object") {
    if (value == null || typeof value !== "object" || Array.isArray(value)) {
      return undefined;
    }
    return stripObjectToSchema(schema, value as Record<string, unknown>);
  }

  if (type === "array") {
    if (!Array.isArray(value)) {
      return undefined;
    }
    const itemSchema = Array.isArray(schema.items)
      ? schema.items[0]
      : schema.items;
    if (!itemSchema) {
      return value;
    }
    return value
      .map((entry) => stripValueToSchema(itemSchema, entry))
      .filter((entry) => entry !== undefined);
  }

  if (type === "string" && typeof value !== "string") {
    return undefined;
  }
  if (type === "number" && typeof value !== "number") {
    return undefined;
  }
  if (type === "integer" && typeof value !== "number") {
    return undefined;
  }
  if (type === "boolean" && typeof value !== "boolean") {
    return undefined;
  }

  return value;
};

/**
 * Strips an object to declared `properties`, optionally keeping dynamic keys when allowed.
 *
 * @param schema - Object schema node.
 * @param value - Raw object.
 * @returns Object containing only schema-allowed keys.
 */
const stripObjectToSchema = (
  schema: JsonSchemaNode,
  value: Record<string, unknown>,
): Record<string, unknown> => {
  const result: Record<string, unknown> = {};

  if (schema.properties) {
    for (const [key, propSchema] of Object.entries(schema.properties)) {
      if (!Object.hasOwn(value, key)) {
        continue;
      }
      const stripped = stripValueToSchema(propSchema, value[key]);
      if (stripped !== undefined) {
        result[key] = stripped;
      }
    }
  }

  const additional = schema.additionalProperties;
  if (additional === true) {
    for (const [key, entry] of Object.entries(value)) {
      if (!Object.hasOwn(result, key)) {
        result[key] = entry;
      }
    }
    return result;
  }

  if (additional && typeof additional === "object") {
    for (const [key, entry] of Object.entries(value)) {
      if (Object.hasOwn(result, key)) {
        continue;
      }
      const stripped = stripValueToSchema(additional, entry);
      if (stripped !== undefined) {
        result[key] = stripped;
      }
    }
  }

  return result;
};

/**
 * Drops config keys that are not allowed by the agent config JSON Schema (AJV `additionalProperties: false`).
 * Aligns Hermes save validation with Zod's strip behavior for regrouped agent configs.
 *
 * @param schema - Agent config schema from the registry.
 * @param config - Config object from the Hermes form or database.
 * @returns Config object containing only schema-declared properties.
 */
export const stripConfigToJsonSchema = (
  schema: Record<string, unknown>,
  config: Record<string, unknown>,
): Record<string, unknown> => {
  const node = schema as JsonSchemaNode;
  if (schemaType(node) !== "object") {
    return config;
  }
  return stripObjectToSchema(node, config);
};
