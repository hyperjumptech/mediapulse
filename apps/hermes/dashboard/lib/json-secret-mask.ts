/**
 * JSON key masking for credentials — no runtime database client or env imports
 * (type-only `Prisma` import for {@link maskSecretsInJson} return typing).
 */

import type { Prisma } from "@hermes/orchestration-database";

/** Mask shown in UI and stored snapshots for secret values (never expose real value). */
export const SECRET_MASK = "••••••••";

/**
 * Redacts common credential substrings that can appear inside free-text fields
 * (`message`, `exception.stack`, etc.) where key-based {@link maskSecretsInJson}
 * does not apply.
 *
 * **What is redacted**
 *
 * - `Bearer <token>`-shaped segments (non-whitespace run after the word `Bearer`).
 * - Entire lines that look like an HTTP `Authorization:` header (case-insensitive).
 *
 * **What is not redacted**
 *
 * - Secrets that appear only as values under non-sensitive JSON keys (handled by
 *   {@link maskSecretsInJson} on the structured payload instead).
 * - Arbitrary API keys or passwords embedded in prose without those patterns.
 *
 * @param value - Raw string from a diagnostic field; must not be null/undefined (callers coerce).
 * @returns The same string with matching patterns replaced by fixed redaction tokens.
 */
export const maskSensitiveInlinePatternsInString = (value: string): string => {
  let out = value;
  out = out.replace(/\bBearer\s+[^\s"'<>]+/gi, "Bearer [redacted]");
  out = out.replace(
    /(^|\n)[^\S\r\n]*authorization:\s*.+?(?=\n|$)/gi,
    (_m, lead) => {
      const prefix = typeof lead === "string" ? lead : "";
      return `${prefix}Authorization: [redacted]`;
    },
  );
  return out;
};

/**
 * Returns true when a JSON object key likely holds a credential or secret.
 * Matching is conservative: values under these keys are masked in the dashboard.
 *
 * @param key - Object property name (leaf segment for nested paths).
 */
export const isSensitiveJsonKey = (key: string): boolean => {
  const leaf = key.includes(".") ? (key.split(".").pop() ?? key) : key;
  const normalized = leaf.replace(/[-_]/g, "").toLowerCase();

  if (
    normalized === "authorization" ||
    normalized === "cookie" ||
    normalized === "session" ||
    normalized === "bearer"
  ) {
    return true;
  }
  if (normalized.includes("password") || normalized.includes("secret")) {
    return true;
  }
  if (normalized.includes("token")) {
    return true;
  }
  if (normalized.includes("apikey")) {
    return true;
  }
  if (normalized.includes("privatekey")) {
    return true;
  }
  return false;
};

/**
 * Deep-clones JSON-like data and replaces values under sensitive keys with a fixed mask.
 *
 * `undefined` is normalized to `null` so the result is always assignable to Prisma JSON fields.
 *
 * @param value - Any JSON-serializable value.
 * @param keyHint - Parent key when recursing into object properties (used for masking).
 */
export const maskSecretsInJson = (
  value: unknown,
  keyHint?: string,
): Prisma.JsonValue => {
  if (keyHint !== undefined && isSensitiveJsonKey(keyHint)) {
    if (value === null || value === undefined) {
      return null;
    }
    return SECRET_MASK;
  }

  if (value === null || value === undefined) {
    return null;
  }
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (typeof value === "bigint") {
    return value.toString();
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map((item) => maskSecretsInJson(item));
  }
  if (typeof value === "object") {
    const out: Record<string, Prisma.JsonValue> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = maskSecretsInJson(v, k);
    }
    return out;
  }
  return SECRET_MASK;
};
