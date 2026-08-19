import Ajv, { type ErrorObject, type JSONSchemaType } from "ajv";
import addFormats from "ajv-formats";

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);

/**
 * Hermes UI-only JSON Schema format for multiline prompt fields
 * ({@link enrichConfigSchemaForHermesUi} in @workspace/agent-runtime).
 */
ajv.addFormat("textarea", {
  type: "string",
  validate: () => true,
});

/**
 * Hermes UI-only annotation keyword recording declared field order
 * ({@link enrichConfigSchemaForHermesUi} in @workspace/agent-runtime). No-op for validation.
 */
ajv.addKeyword({ keyword: "propertyOrder" });

const VARIABLE_PLACEHOLDER_REGEX = /\{\{[^{}]+\}\}/;

const PLACEHOLDER_DEFERRED_KEYWORDS = new Set(["format", "pattern"]);

function resolveInstancePath(data: unknown, instancePath: string): unknown {
  if (instancePath === "") {
    return data;
  }

  let current: unknown = data;
  for (const rawSegment of instancePath.slice(1).split("/")) {
    if (current === null || typeof current !== "object") {
      return undefined;
    }
    const segment = rawSegment.replace(/~1/g, "/").replace(/~0/g, "~");
    current = (current as Record<string, unknown>)[segment];
  }

  return current;
}

function isDeferredPlaceholderError(
  error: ErrorObject,
  data: unknown,
): boolean {
  if (!PLACEHOLDER_DEFERRED_KEYWORDS.has(error.keyword)) {
    return false;
  }

  const value = resolveInstancePath(data, error.instancePath);

  return typeof value === "string" && VARIABLE_PLACEHOLDER_REGEX.test(value);
}

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
    const remaining = (validate.errors ?? []).filter(
      (error) => !isDeferredPlaceholderError(error, data),
    );
    if (remaining.length === 0) return { valid: true };
    const errors = remaining.map((e) =>
      `${e.instancePath || "/"} ${e.message ?? "validation failed"}`.trim(),
    );
    return { valid: false, errors };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { valid: false, errors: [message] };
  }
}
