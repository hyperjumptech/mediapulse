import Ajv, { type JSONSchemaType } from "ajv";

const ajv = new Ajv({ allErrors: true });

/**
 * Validates data against a JSON Schema.
 *
 * @param schema - JSON Schema object (e.g. from agent registry).
 * @param data - Data to validate.
 * @returns Object with valid: true, or valid: false and errors array.
 */
export function validateWithJsonSchema(
  schema: Record<string, unknown>,
  data: unknown,
): { valid: true } | { valid: false; errors: string[] } {
  try {
    const validate = ajv.compile(schema as JSONSchemaType<unknown>);
    const ok = validate(data);
    if (ok) return { valid: true };
    const errors = (validate.errors ?? []).map((e) =>
      `${e.instancePath || "/"} ${e.message ?? "validation failed"}`.trim(),
    );
    return { valid: false, errors };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { valid: false, errors: [message] };
  }
}
