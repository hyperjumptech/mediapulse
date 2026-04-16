/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import {
  applyPerArticleExtractionCaps,
  applyPerRunCaps,
  dedupeEntities,
  dedupeRelations,
} from "./analysis-caps-dedupe.js";

const TID = "11111111-1111-4111-a111-111111111111";

describe("applyPerArticleExtractionCaps", () => {
  it("truncates entities and relations", () => {
    // Act
    const out = applyPerArticleExtractionCaps(
      [
        { canonicalName: "A", typeId: TID, aliases: [] },
        { canonicalName: "B", typeId: TID, aliases: [] },
      ],
      [
        {
          fromEntityName: "A",
          toEntityName: "B",
          relationTypeId: "22222222-2222-4222-a222-222222222222",
        },
        {
          fromEntityName: "B",
          toEntityName: "A",
          relationTypeId: "22222222-2222-4222-a222-222222222222",
        },
      ],
      1,
      1,
    );
    // Assert
    expect(out.entities).toHaveLength(1);
    expect(out.relations).toHaveLength(1);
  });
});

describe("dedupeEntities", () => {
  it("keeps first entity per normalized canonical and typeId", () => {
    // Act
    const out = dedupeEntities([
      { canonicalName: " Acme ", typeId: TID, aliases: [] },
      { canonicalName: "ACME", typeId: TID, description: "dup", aliases: [] },
    ]);
    // Assert
    expect(out).toHaveLength(1);
    expect(out[0]?.canonicalName).toBe(" Acme ");
  });
});

describe("dedupeRelations", () => {
  it("dedupes by normalized endpoints and relation type", () => {
    // Act
    const rid = "22222222-2222-4222-a222-222222222222";
    const out = dedupeRelations([
      { fromEntityName: "A", toEntityName: "B", relationTypeId: rid },
      { fromEntityName: " a ", toEntityName: " b ", relationTypeId: rid },
    ]);
    // Assert
    expect(out).toHaveLength(1);
  });
});

describe("applyPerRunCaps", () => {
  it("drops relations whose endpoints are removed by the entity cap", () => {
    // Act
    const ents = [
      { canonicalName: "A", typeId: TID, aliases: [] },
      { canonicalName: "B", typeId: TID, aliases: [] },
    ];
    const rels = [
      {
        fromEntityName: "A",
        toEntityName: "B",
        relationTypeId: "22222222-2222-4222-a222-222222222222",
      },
    ];
    const out = applyPerRunCaps(ents, rels, 1, 1);
    // Assert
    expect(out.entities).toHaveLength(1);
    expect(out.relations).toHaveLength(0);
  });
});
