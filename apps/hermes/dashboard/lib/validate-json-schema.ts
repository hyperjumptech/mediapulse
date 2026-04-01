import Ajv, { type JSONSchemaType } from "ajv";
import addFormats from "ajv-formats";

const ajv = new Ajv({ allErrors: true });
const ajvRemoveAdditional = new Ajv({ allErrors: true, removeAdditional: "all" });
addFormats(ajv);
addFormats(ajvRemoveAdditional);

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

/**
 * Validates data against a JSON schema while removing additional properties.
 *
 * @param schema - JSON Schema object.
 * @param data - Data to validate (cloned before mutation).
 * @returns Validation result and sanitized value when valid.
 */
export function validateAndSanitizeWithJsonSchema(
  schema: Record<string, unknown>,
  data: unknown,
):
  | { valid: true; data: Record<string, unknown> }
  | { valid: false; errors: string[] } {
  try {
    const validate = ajvRemoveAdditional.compile(
      schema as JSONSchemaType<unknown>,
    );
    const candidate =
      typeof data === "object" && data !== null && !Array.isArray(data)
        ? ({ ...data } as Record<string, unknown>)
        : {};
    const ok = validate(candidate);
    if (ok) {
      return { valid: true, data: candidate };
    }
    const errors = (validate.errors ?? []).map((e) =>
      `${e.instancePath || "/"} ${e.message ?? "validation failed"}`.trim(),
    );
    return { valid: false, errors };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { valid: false, errors: [message] };
  }
}
