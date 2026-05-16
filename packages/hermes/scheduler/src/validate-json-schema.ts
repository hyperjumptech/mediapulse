import { registerHermesUiJsonSchemaFormats } from "@workspace/agent-runtime/register-hermes-ui-json-schema-formats";
import Ajv, { type JSONSchemaType } from "ajv";
import addFormats from "ajv-formats";

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);
registerHermesUiJsonSchemaFormats(ajv);

type JsonSchemaLike = {
  type?: string | string[];
  required?: string[];
  properties?: Record<string, JsonSchemaLike>;
  definitions?: Record<string, JsonSchemaLike>;
  $defs?: Record<string, JsonSchemaLike>;
  $ref?: string;
};

/**
 * Resolves a local JSON Schema ref like "#/definitions/Foo".
 *
 * @param root - Root schema object.
 * @param ref - JSON pointer ref string.
 * @returns Resolved schema node, or null when unresolved.
 */
function resolveLocalRef(
  root: JsonSchemaLike,
  ref: string,
): JsonSchemaLike | null {
  if (!ref.startsWith("#/")) return null;
  const parts = ref
    .slice(2)
    .split("/")
    .map((p) => p.replace(/~1/g, "/").replace(/~0/g, "~"));
  let current: unknown = root;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return null;
    current = (current as Record<string, unknown>)[part];
  }
  return current != null && typeof current === "object"
    ? (current as JsonSchemaLike)
    : null;
}

/**
 * Collects errors for required string fields that are present but empty.
 * JSON Schema "required" validates key existence only.
 *
 * @param schema - Schema with required/properties metadata.
 * @param data - Data object to validate.
 * @param path - Current JSON path.
 * @returns Error messages for empty required strings.
 */
function collectEmptyRequiredStringErrors(
  schema: JsonSchemaLike,
  data: unknown,
  path = "/",
): string[] {
  return collectEmptyRequiredStringErrorsInternal(schema, data, path, schema);
}

/**
 * Internal recursive implementation with root schema for ref resolution.
 *
 * @param schema - Current schema node.
 * @param data - Data object to validate.
 * @param path - Current JSON path.
 * @param root - Root schema object.
 * @returns Error messages for empty required strings.
 */
function collectEmptyRequiredStringErrorsInternal(
  schema: JsonSchemaLike,
  data: unknown,
  path: string,
  root: JsonSchemaLike,
): string[] {
  const errors: string[] = [];
  const resolved =
    typeof schema.$ref === "string"
      ? (resolveLocalRef(root, schema.$ref) ?? schema)
      : schema;
  const type = Array.isArray(resolved.type) ? resolved.type[0] : resolved.type;
  if (
    type !== "object" ||
    !resolved.properties ||
    !Array.isArray(resolved.required)
  )
    return errors;

  const obj =
    data != null && typeof data === "object" && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : {};

  for (const key of resolved.required) {
    const fieldSchema = resolved.properties[key];
    if (!fieldSchema) continue;
    const value = obj[key];
    const resolvedFieldSchema =
      typeof fieldSchema.$ref === "string"
        ? (resolveLocalRef(root, fieldSchema.$ref) ?? fieldSchema)
        : fieldSchema;
    const fieldType = Array.isArray(resolvedFieldSchema.type)
      ? resolvedFieldSchema.type[0]
      : resolvedFieldSchema.type;
    const fieldPath = path === "/" ? `/${key}` : `${path}/${key}`;

    if (fieldType === "string") {
      if (typeof value !== "string" || value.trim() === "") {
        errors.push(`${fieldPath} is required`);
      }
      continue;
    }

    if (fieldType === "object") {
      if (value == null || typeof value !== "object" || Array.isArray(value)) {
        errors.push(`${fieldPath} is required`);
      } else {
        errors.push(
          ...collectEmptyRequiredStringErrorsInternal(
            resolvedFieldSchema,
            value,
            fieldPath,
            root,
          ),
        );
      }
    }
  }

  return errors;
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
    const emptyRequiredErrors = collectEmptyRequiredStringErrors(
      schema as JsonSchemaLike,
      data,
    );
    const validate = ajv.compile(schema as JSONSchemaType<unknown>);
    const ok = validate(data);
    if (ok && emptyRequiredErrors.length === 0) return { valid: true };
    const errors = (validate.errors ?? []).map((e) =>
      `${e.instancePath || "/"} ${e.message ?? "validation failed"}`.trim(),
    );
    return { valid: false, errors: [...errors, ...emptyRequiredErrors] };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { valid: false, errors: [message] };
  }
}
