/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import { validateExtractionVocabulary } from "./analysis-vocabulary.js";

const TYPE_OK = "11111111-1111-4111-a111-111111111111";
const TYPE_BAD = "22222222-2222-4222-a222-222222222222";
const REL_OK = "33333333-3333-4333-a333-333333333333";
const REL_BAD = "44444444-4444-4444-a444-444444444444";

describe("validateExtractionVocabulary", () => {
  it("accepts ids present on GET vocabulary", () => {
    // Act
    const r = validateExtractionVocabulary(
      [
        {
          canonicalName: "Acme",
          typeId: TYPE_OK,
          aliases: [],
        },
      ],
      [
        {
          fromEntityName: "Acme",
          toEntityName: "Beta",
          relationTypeId: REL_OK,
        },
      ],
      {
        entityTypes: [{ id: TYPE_OK, name: "Co", description: null }],
        relationTypes: [{ id: REL_OK, name: "owns", description: null }],
      },
    );
    // Assert
    expect(r).toEqual({ ok: true });
  });

  it("rejects unknown entity typeId", () => {
    // Act
    const r = validateExtractionVocabulary(
      [{ canonicalName: "X", typeId: TYPE_BAD, aliases: [] }],
      [],
      {
        entityTypes: [{ id: TYPE_OK, name: "Co", description: null }],
        relationTypes: [],
      },
    );
    // Assert
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.message).toContain("Invalid entity typeId");
    }
  });

  it("rejects unknown relationTypeId", () => {
    // Act
    const r = validateExtractionVocabulary(
      [],
      [
        {
          fromEntityName: "A",
          toEntityName: "B",
          relationTypeId: REL_BAD,
        },
      ],
      {
        entityTypes: [],
        relationTypes: [{ id: REL_OK, name: "r", description: null }],
      },
    );
    // Assert
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.message).toContain("Invalid relationTypeId");
    }
  });
});
