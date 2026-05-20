/**
 * Parses JSON textarea fields from Hermes create/update payloads before Zod validation.
 */

/**
 * Parses a JSON object field from a request body (string or object).
 *
 * @param value - Raw field from the HTTP body.
 * @param fieldName - Label used in error messages.
 * @returns Parsed object or an error message.
 */
export const parseJsonObjectField = (
  value: unknown,
  fieldName: string,
):
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; message: string } => {
  if (value === null || value === undefined) {
    return { ok: false, message: `${fieldName} is required` };
  }
  if (typeof value === "object" && !Array.isArray(value)) {
    return { ok: true, value: value as Record<string, unknown> };
  }
  if (typeof value !== "string") {
    return { ok: false, message: `${fieldName} must be a JSON object` };
  }
  const trimmed = value.trim();
  if (trimmed === "") {
    return { ok: false, message: `${fieldName} is required` };
  }
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return { ok: false, message: `${fieldName} must be a JSON object` };
    }
    return { ok: true, value: parsed as Record<string, unknown> };
  } catch {
    return { ok: false, message: `${fieldName} must be valid JSON` };
  }
};

/**
 * Parses a JSON array field from a request body (string or array).
 *
 * @param value - Raw field from the HTTP body.
 * @param fieldName - Label used in error messages.
 * @returns Parsed array or an error message.
 */
export const parseJsonArrayField = (
  value: unknown,
  fieldName: string,
): { ok: true; value: unknown[] } | { ok: false; message: string } => {
  if (value === null || value === undefined) {
    return { ok: false, message: `${fieldName} is required` };
  }
  if (Array.isArray(value)) {
    return { ok: true, value };
  }
  if (typeof value !== "string") {
    return { ok: false, message: `${fieldName} must be a JSON array` };
  }
  const trimmed = value.trim();
  if (trimmed === "") {
    return { ok: false, message: `${fieldName} is required` };
  }
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (!Array.isArray(parsed)) {
      return { ok: false, message: `${fieldName} must be a JSON array` };
    }
    return { ok: true, value: parsed };
  } catch {
    return { ok: false, message: `${fieldName} must be valid JSON` };
  }
};
