import { describe, expect, it } from "vitest";

import { resolveContentGenerationConfig } from "./config-schema.js";
import { computeConfigVersion } from "./compute-config-version.js";

describe("computeConfigVersion", () => {
  // -------------------------------------------------------------------------
  // Determinism
  // -------------------------------------------------------------------------

  it("returns the same hash for the same config called twice", () => {
    // Setup
    const config = resolveContentGenerationConfig({
      model: { apiKey: "sk-test" },
    });

    // Act
    const hash1 = computeConfigVersion(config);
    const hash2 = computeConfigVersion(config);

    // Assert
    expect(hash1).toBe(hash2);
  });

  it("returns a 16-character hex string", () => {
    // Setup
    const config = resolveContentGenerationConfig({
      model: { apiKey: "sk-test" },
    });

    // Act
    const hash = computeConfigVersion(config);

    // Assert
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
  });

  // -------------------------------------------------------------------------
  // API key exclusion (acceptance criterion: two configs differing only in
  // apiKey must produce the same configVersion)
  // -------------------------------------------------------------------------

  it("produces the same hash for two configs differing only in model.apiKey", () => {
    // Setup
    const configA = resolveContentGenerationConfig({
      model: { apiKey: "sk-key-alpha" },
    });
    const configB = resolveContentGenerationConfig({
      model: { apiKey: "sk-key-beta" },
    });

    // Act
    const hashA = computeConfigVersion(configA);
    const hashB = computeConfigVersion(configB);

    // Assert
    expect(hashA).toBe(hashB);
  });

  it("produces the same hash regardless of API key presence when all other fields are equal", () => {
    // Setup — two configs with different api keys, same everything else
    const configWithKey = resolveContentGenerationConfig({
      model: { apiKey: "sk-some-key", model: "gpt-4o" },
    });
    const configWithDifferentKey = resolveContentGenerationConfig({
      model: { apiKey: "sk-completely-different-key", model: "gpt-4o" },
    });

    // Act
    const hashA = computeConfigVersion(configWithKey);
    const hashB = computeConfigVersion(configWithDifferentKey);

    // Assert
    expect(hashA).toBe(hashB);
  });

  // -------------------------------------------------------------------------
  // Sensitivity: changing a non-secret field changes the hash
  // -------------------------------------------------------------------------

  it("produces a different hash when model.model changes", () => {
    // Setup
    const configA = resolveContentGenerationConfig({
      model: { apiKey: "sk-test", model: "gpt-4o-mini" },
    });
    const configB = resolveContentGenerationConfig({
      model: { apiKey: "sk-test", model: "gpt-4o" },
    });

    // Act
    const hashA = computeConfigVersion(configA);
    const hashB = computeConfigVersion(configB);

    // Assert
    expect(hashA).not.toBe(hashB);
  });

  it("produces a different hash when duplicateGuard.timezone changes", () => {
    // Setup
    const configA = resolveContentGenerationConfig({
      model: { apiKey: "sk-test" },
      duplicateGuard: { timezone: "Asia/Jakarta" },
    });
    const configB = resolveContentGenerationConfig({
      model: { apiKey: "sk-test" },
      duplicateGuard: { timezone: "America/New_York" },
    });

    // Act
    const hashA = computeConfigVersion(configA);
    const hashB = computeConfigVersion(configB);

    // Assert
    expect(hashA).not.toBe(hashB);
  });

  // -------------------------------------------------------------------------
  // Property insertion order stability
  // -------------------------------------------------------------------------

  it("produces the same hash regardless of property insertion order", () => {
    // Setup — two configs that are semantically identical but built in different order
    const configA = resolveContentGenerationConfig({
      model: { apiKey: "sk-test", model: "gpt-4o-mini" },
      duplicateGuard: { timezone: "Asia/Jakarta" },
    });

    // Rebuild with keys in a different order by spreading
    const configBRaw = {
      duplicateGuard: { timezone: "Asia/Jakarta" },
      model: { apiKey: "sk-test", model: "gpt-4o-mini" },
    };
    const configB = resolveContentGenerationConfig(configBRaw);

    // Act
    const hashA = computeConfigVersion(configA);
    const hashB = computeConfigVersion(configB);

    // Assert
    expect(hashA).toBe(hashB);
  });

  // -------------------------------------------------------------------------
  // Does not mutate the original config
  // -------------------------------------------------------------------------

  it("does not mutate the original config object", () => {
    // Setup
    const config = resolveContentGenerationConfig({
      model: { apiKey: "sk-original", model: "gpt-4o" },
    });
    const originalNestedKey = config.model.apiKey;

    // Act
    computeConfigVersion(config);

    // Assert
    expect(config.model.apiKey).toBe(originalNestedKey);
  });
});
