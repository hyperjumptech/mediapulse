import type { ScheduleExecutionDetail } from "@/lib/schedules";

import { SECRET_MASK } from "@/lib/variables";

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
 * @param value - Any JSON-serializable value.
 * @param keyHint - Parent key when recursing into object properties (used for masking).
 */
export const maskSecretsInJson = (
  value: unknown,
  keyHint?: string,
): unknown => {
  if (keyHint !== undefined && isSensitiveJsonKey(keyHint)) {
    if (value === null || value === undefined) {
      return value;
    }
    return SECRET_MASK;
  }

  if (value === null || value === undefined) {
    return value;
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
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = maskSecretsInJson(v, k);
    }
    return out;
  }
  return SECRET_MASK;
};

/**
 * Returns a copy of schedule execution detail with invocation `params` and `invocationConfig`
 * redacted for safe display in the dashboard (never expose resolved secrets in HTML or JSON APIs).
 *
 * @param detail - Loaded execution detail from the database.
 */
export const maskScheduleExecutionDetailForDisplay = (
  detail: ScheduleExecutionDetail,
): ScheduleExecutionDetail => ({
  ...detail,
  invocations: detail.invocations.map((inv) => ({
    ...inv,
    params: maskSecretsInJson(inv.params),
    invocationConfig:
      inv.invocationConfig == null
        ? null
        : maskSecretsInJson(inv.invocationConfig),
  })),
});
