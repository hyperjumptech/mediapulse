import { createHash } from "node:crypto";

import type { ContentGenerationConfig } from "./config-schema.js";

/**
 * Serializes a config object to a deterministic JSON string with keys sorted
 * at every level. Ensures the hash is stable regardless of property insertion order.
 *
 * @param value - The value to serialize.
 * @returns Deterministically ordered JSON string.
 */
function deterministicStringify(value: unknown): string {
  return JSON.stringify(value, (_key, val) => {
    if (val !== null && typeof val === "object" && !Array.isArray(val)) {
      const sorted: Record<string, unknown> = {};
      for (const k of Object.keys(val as Record<string, unknown>).sort()) {
        sorted[k] = (val as Record<string, unknown>)[k];
      }
      return sorted;
    }
    return val;
  });
}

/**
 * Computes a deterministic short hash of the validated agent config, excluding
 * secret fields so the hash can be stored safely.
 *
 * Algorithm: SHA-256(deterministicJSON(configWithoutSecrets)) → first 16 hex chars.
 *
 * Secret exclusions:
 * - `model.apiKey`
 *
 * This means two configs that differ only in their API key will produce the
 * same `configVersion`, which is the desired behaviour: the version tracks
 * *operational* configuration, not credentials.
 *
 * @param config - Parsed and validated content-generation agent config.
 * @returns 16-character hex string uniquely identifying the non-secret config.
 */
export function computeConfigVersion(config: ContentGenerationConfig): string {
  const clone: Record<string, unknown> = { ...config };

  if (clone.model && typeof clone.model === "object") {
    const { apiKey: _apiKey, ...modelRest } = clone.model as Record<
      string,
      unknown
    >;
    clone.model = modelRest;
  }

  const serialized = deterministicStringify(clone);
  return createHash("sha256").update(serialized).digest("hex").slice(0, 16);
}
