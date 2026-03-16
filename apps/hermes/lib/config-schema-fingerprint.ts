/**
 * Computes a stable, deterministic fingerprint of a JSON Schema object.
 * Used to detect when an agent's config schema has changed (same agentId/version, different schema).
 *
 * @param schema - JSON Schema object (e.g. from agent registry configSchema).
 * @returns A string fingerprint; same schema always yields the same string.
 */
export function configSchemaFingerprint(
  schema: Record<string, unknown> | null | undefined,
): string {
  if (schema == null || typeof schema !== "object") {
    return "";
  }
  return JSON.stringify(sortKeysRecursive(schema));
}

/**
 * Returns a copy of the object with all keys recursively sorted for deterministic stringify.
 */
function sortKeysRecursive(value: unknown): unknown {
  if (value == null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(sortKeysRecursive);
  }
  const obj = value as Record<string, unknown>;
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) {
    sorted[key] = sortKeysRecursive(obj[key]);
  }
  return sorted;
}
