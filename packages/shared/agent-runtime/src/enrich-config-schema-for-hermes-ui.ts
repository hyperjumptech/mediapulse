const HERMES_PROMPT_STRING_FIELD_KEYS = [
  "systemPrompt",
  "userPromptTemplate",
] as const;

/**
 * Sets `format: "textarea"` on known LLM prompt string fields under `prompts` so Hermes
 * {@link @workspace/json-schema-form} renders multiline inputs instead of single-line fields.
 *
 * @param schema - Config JSON Schema from `zodToJsonSchema` (root `type: "object"`).
 * @returns A cloned schema with Hermes UI hints applied (does not mutate the input).
 */
export const enrichConfigSchemaForHermesUi = (
  schema: Record<string, unknown>,
): Record<string, unknown> => {
  const cloned = structuredClone(schema);
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
