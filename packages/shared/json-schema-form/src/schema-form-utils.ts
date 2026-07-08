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
 * Returns `[key, propertySchema]` entries of an object schema in its declared render order.
 *
 * Honors `propertyOrder` first (keys listed there, then any not listed), falling back to the
 * natural `properties` key order. Used so field order survives `jsonb` storage.
 */
export const orderedPropertyEntries = (
  schema: JsonSchema,
): [string, JsonSchema][] => {
  const properties = schema.properties;
  if (!properties) return [];
  const order = schema.propertyOrder;
  if (!order || order.length === 0) return Object.entries(properties);
  const seen = new Set<string>();
  const ordered: [string, JsonSchema][] = [];
  for (const key of order) {
    const propertySchema = properties[key];
    if (propertySchema && !seen.has(key)) {
      ordered.push([key, propertySchema]);
      seen.add(key);
    }
  }
  for (const [key, propertySchema] of Object.entries(properties)) {
    if (!seen.has(key)) ordered.push([key, propertySchema]);
  }

  return ordered;
};

/**
 * Returns the object subschema variants of a discriminated union (anyOf/oneOf), or null.
 */
export const getUnionVariants = (
  schema: JsonSchema,
): [JsonSchema, ...JsonSchema[]] | null => {
  const variants = schema.anyOf ?? schema.oneOf;
  if (Array.isArray(variants) && variants.length > 0) {
    return variants as [JsonSchema, ...JsonSchema[]];
  }
  return null;
};

/**
 * Values a variant constrains a property to, via `const` or `enum` (empty when unconstrained).
 */
const variantDiscriminatorValues = (
  variant: JsonSchema,
  key: string,
): string[] => {
  const prop = variant.properties?.[key];
  if (!prop) return [];
  if (prop.const !== undefined) return [String(prop.const)];
  if (prop.enum != null && prop.enum.length > 0) {
    return prop.enum.map((value) => String(value));
  }
  return [];
};

/**
 * Resolves the discriminator property and active variant of a union for a given value.
 *
 * The discriminator is the first property every variant constrains to a `const` or `enum`.
 * Returns null when the variants share no such property.
 */
export const resolveUnionVariant = (
  variants: [JsonSchema, ...JsonSchema[]],
  value: unknown,
): {
  discriminator: string;
  options: { value: string; index: number }[];
  activeIndex: number;
  activeSchema: JsonSchema;
} | null => {
  const firstProperties = variants[0]?.properties;
  if (!firstProperties) return null;

  let discriminator: string | null = null;
  for (const key of Object.keys(firstProperties)) {
    const everyVariantConstrainsKey = variants.every(
      (variant) => variantDiscriminatorValues(variant, key).length > 0,
    );
    if (everyVariantConstrainsKey) {
      discriminator = key;
      break;
    }
  }
  if (discriminator == null) return null;

  const options = variants.flatMap((variant, index) =>
    variantDiscriminatorValues(variant, discriminator).map((value) => ({
      value,
      index,
    })),
  );
  const currentValue =
    value != null && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)[discriminator]
      : undefined;
  const match = options.find((option) => option.value === currentValue);
  const activeIndex = match?.index ?? 0;
  const activeSchema = variants[activeIndex] ?? variants[0];

  return {
    discriminator,
    options,
    activeIndex: variants[activeIndex] ? activeIndex : 0,
    activeSchema,
  };
};

/**
 * Returns a default value for a schema (used to seed required keys).
 */
export const defaultForSchema = (schema: JsonSchema): unknown => {
  if (schema.default !== undefined) return schema.default;
  const unionVariants = getUnionVariants(schema);
  if (unionVariants) return defaultForSchema(unionVariants[0]);
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
 * Returns a properly seeded value for a new array item.
 *
 * For objects, merges required-key seeds with declared property defaults so the
 * new entry has valid enum selections and declared defaults rather than raw empty strings.
 * For all other types, delegates to `defaultForSchema`.
 */
export const seedNewArrayItem = (schema: JsonSchema): unknown => {
  const unionVariants = getUnionVariants(schema);
  if (unionVariants) return seedNewArrayItem(unionVariants[0]);
  if (getSchemaFormType(schema) === "object") {
    const required = defaultForSchema(schema) as object;
    const declared = (collectSchemaDefaults(schema) ?? {}) as object;
    return { ...required, ...declared };
  }
  return defaultForSchema(schema);
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
