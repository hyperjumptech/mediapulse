const HERMES_PROMPT_STRING_FIELD_KEYS = [
  "systemPrompt",
  "userPromptTemplate",
] as const;

type JsonRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is JsonRecord =>
  value != null && typeof value === "object" && !Array.isArray(value);

/**
 * Records each object's property key order into a `propertyOrder` array so the Hermes UI
 * can render fields in the schema's declared order.
 *
 * The registry stores config schemas as Postgres `jsonb`, which does not preserve object key
 * order. Arrays keep their order, so `propertyOrder` survives the round trip while the raw
 * `properties` key order does not.
 */
const recordPropertyOrder = (node: unknown): void => {
  if (!isRecord(node)) return;

  const properties = node.properties;
  if (isRecord(properties)) {
    node.propertyOrder = Object.keys(properties);
    for (const child of Object.values(properties)) {
      recordPropertyOrder(child);
    }
  }

  if (isRecord(node.items)) recordPropertyOrder(node.items);
  if (isRecord(node.additionalProperties)) {
    recordPropertyOrder(node.additionalProperties);
  }
  for (const unionKey of ["anyOf", "oneOf", "allOf"] as const) {
    const variants = node[unionKey];
    if (Array.isArray(variants)) {
      for (const variant of variants) recordPropertyOrder(variant);
    }
  }
};

/**
 * Applies Hermes UI hints to a config JSON Schema: multiline inputs for known LLM prompt
 * fields and a `propertyOrder` array on every object so field order survives `jsonb` storage.
 *
 * @param schema - Config JSON Schema from `zodToJsonSchema` (root `type: "object"`).
 * @returns A cloned schema with Hermes UI hints applied (does not mutate the input).
 */
export const enrichConfigSchemaForHermesUi = (
  schema: Record<string, unknown>,
): Record<string, unknown> => {
  const cloned = structuredClone(schema);

  recordPropertyOrder(cloned);

  const properties = cloned.properties;
  if (
    properties == null ||
    typeof properties !== "object" ||
    Array.isArray(properties)
  ) {
    return cloned;
  }

  const prompts = (properties as Record<string, unknown>).prompts;
  if (
    prompts == null ||
    typeof prompts !== "object" ||
    Array.isArray(prompts)
  ) {
    return cloned;
  }

  const promptProperties = (prompts as Record<string, unknown>).properties;
  if (
    promptProperties == null ||
    typeof promptProperties !== "object" ||
    Array.isArray(promptProperties)
  ) {
    return cloned;
  }

  const props = promptProperties as Record<string, Record<string, unknown>>;
  for (const key of HERMES_PROMPT_STRING_FIELD_KEYS) {
    const field = props[key];
    if (
      field != null &&
      typeof field === "object" &&
      !Array.isArray(field) &&
      field.type === "string"
    ) {
      field.format = "textarea";
    }
  }

  return cloned;
};
