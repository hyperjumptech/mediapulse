/** @vitest-environment node */

import { describe, expect, it } from "vitest";

import { DEFAULT_EXTRACTION_EXEMPLARS } from "./default-extraction-exemplars.js";
import {
  resolveExemplarForContext,
  resolveExemplarsForContext,
} from "./resolve-extraction-exemplars.js";

const COMPANY_ID = "11111111-1111-4111-a111-111111111111";
const PERSON_ID = "22222222-2222-4222-a222-222222222222";
const PRODUCT_ID = "33333333-3333-4333-a333-333333333333";
const CEO_OF_ID = "44444444-4444-4444-a444-444444444444";
const PARTNER_OF_ID = "55555555-5555-4555-a555-555555555555";

const baseVocabulary = {
  entityTypes: [
    { id: COMPANY_ID, name: "COMPANY", description: null },
    { id: PERSON_ID, name: "PERSON", description: null },
    { id: PRODUCT_ID, name: "PRODUCT", description: null },
  ],
  relationTypes: [
    { id: CEO_OF_ID, name: "CEO_OF", description: null },
    { id: PARTNER_OF_ID, name: "PARTNER_OF", description: null },
  ],
};

describe("resolveExemplarForContext", () => {
  it("materializes sentinel placeholders into vocabulary UUIDs", () => {
    // Act
    const resolved = resolveExemplarForContext(
      DEFAULT_EXTRACTION_EXEMPLARS[0]!,
      baseVocabulary,
    );

    // Assert
    expect(resolved).not.toBeNull();
    expect(resolved?.expectedOutput.entities[0]?.typeId).toBe(COMPANY_ID);
  });

  it("returns null when a referenced entity type is missing from vocabulary", () => {
    // Act
    const resolved = resolveExemplarForContext(
      DEFAULT_EXTRACTION_EXEMPLARS[1]!,
      baseVocabulary,
    );

    // Assert
    expect(resolved).toBeNull();
  });
});

describe("resolveExemplarsForContext", () => {
  it("skips legal exemplar when Regulator is absent and returns remaining archetypes", () => {
    // Act
    const resolved = resolveExemplarsForContext(
      DEFAULT_EXTRACTION_EXEMPLARS,
      baseVocabulary,
      4,
    );

    // Assert
    expect(resolved.map((exemplar) => exemplar.archetype)).toEqual([
      "earnings",
      "leadership",
      "product",
    ]);
  });

  it("returns at most the requested count in library order", () => {
    // Act
    const resolved = resolveExemplarsForContext(
      DEFAULT_EXTRACTION_EXEMPLARS,
      baseVocabulary,
      2,
    );

    // Assert
    expect(resolved).toHaveLength(2);
    expect(resolved.map((exemplar) => exemplar.archetype)).toEqual([
      "earnings",
      "leadership",
    ]);
  });

  it("returns an empty list when count is zero", () => {
    // Act
    const resolved = resolveExemplarsForContext(
      DEFAULT_EXTRACTION_EXEMPLARS,
      baseVocabulary,
      0,
    );

    // Assert
    expect(resolved).toEqual([]);
  });

  it("filters by allowed archetypes when configured", () => {
    // Act
    const resolved = resolveExemplarsForContext(
      DEFAULT_EXTRACTION_EXEMPLARS,
      baseVocabulary,
      2,
      ["product", "earnings"],
    );

    // Assert
    expect(resolved.map((exemplar) => exemplar.archetype)).toEqual([
      "earnings",
      "product",
    ]);
  });
});
