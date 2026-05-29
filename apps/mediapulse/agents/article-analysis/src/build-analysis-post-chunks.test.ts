/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import {
  buildAnalysisPostChunks,
  buildEntityNameLookup,
} from "./build-analysis-post-chunks.js";

const TID = "11111111-1111-4111-a111-111111111111";
const RID = "22222222-2222-4222-a222-222222222222";

describe("buildEntityNameLookup", () => {
  it("maps canonical and alias", () => {
    // Setup
    const entities = [
      {
        canonicalName: "Apple Inc",
        typeId: TID,
        aliases: ["Apple"],
      },
    ];
    // Act
    const map = buildEntityNameLookup(entities);
    // Assert
    expect(map.get("apple inc")?.canonicalName).toBe("Apple Inc");
    expect(map.get("apple")?.canonicalName).toBe("Apple Inc");
  });
});

describe("buildAnalysisPostChunks", () => {
  it("partitions entity and relation evidence per chunk", () => {
    // Setup
    const tickerId = "t1";
    const entities = [
      { canonicalName: "A", typeId: TID, aliases: [] as string[] },
      { canonicalName: "B", typeId: TID, aliases: [] as string[] },
      { canonicalName: "C", typeId: TID, aliases: [] as string[] },
    ];
    const relations = [
      { fromEntityName: "A", toEntityName: "B", relationTypeId: RID },
      { fromEntityName: "B", toEntityName: "C", relationTypeId: RID },
    ];
    const entityEvidence = [
      { dataSourceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", entityName: "A" },
      { dataSourceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", entityName: "C" },
    ];
    const relationEvidence = [
      {
        dataSourceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        fromEntityName: "A",
        toEntityName: "B",
        relationTypeId: RID,
      },
    ];

    // Act
    const { chunks } = buildAnalysisPostChunks(
      tickerId,
      entities,
      relations,
      1,
      entityEvidence,
      relationEvidence,
    );

    // Assert
    expect(chunks[0]?.entityEvidence).toHaveLength(1);
    expect(chunks[0]?.entityEvidence[0]?.entityName).toBe("A");
    expect(chunks[0]?.relationEvidence).toHaveLength(1);
    expect(chunks[1]?.entityEvidence).toHaveLength(1);
    expect(chunks[1]?.entityEvidence[0]?.entityName).toBe("C");
    expect(chunks[1]?.relationEvidence).toHaveLength(0);
  });

  it("includes entity closure per chunk for cross-chunk endpoint reuse", () => {
    // Setup
    const tickerId = "t1";
    const entities = [
      {
        canonicalName: "A",
        typeId: TID,
        aliases: [],
      },
      {
        canonicalName: "B",
        typeId: TID,
        aliases: [],
      },
      {
        canonicalName: "C",
        typeId: TID,
        aliases: [],
      },
    ];
    const relations = [
      { fromEntityName: "A", toEntityName: "B", relationTypeId: RID },
      { fromEntityName: "B", toEntityName: "C", relationTypeId: RID },
    ];
    // Act
    const { chunks } = buildAnalysisPostChunks(
      tickerId,
      entities,
      relations,
      1,
    );
    // Assert
    expect(chunks).toHaveLength(2);
    expect(chunks[0]?.relations).toHaveLength(1);
    expect(chunks[0]?.entities.map((e) => e.canonicalName).sort()).toEqual(
      ["A", "B"].sort(),
    );
    expect(chunks[1]?.entities.map((e) => e.canonicalName).sort()).toEqual(
      ["B", "C"].sort(),
    );
  });

  it("drops relations when endpoint is missing from catalog", () => {
    // Act
    const { chunks, droppedRelations } = buildAnalysisPostChunks(
      "t",
      [
        {
          canonicalName: "Only",
          typeId: TID,
          aliases: [],
        },
      ],
      [
        {
          fromEntityName: "Only",
          toEntityName: "Ghost",
          relationTypeId: RID,
        },
      ],
      10,
    );
    // Assert
    expect(chunks).toHaveLength(0);
    expect(droppedRelations).toBe(1);
  });

  it("emits one chunk with entities only when there are no relations", () => {
    // Setup
    const tickerId = "t1";
    const entities = [
      { canonicalName: "A", typeId: TID, aliases: [] as string[] },
      { canonicalName: "B", typeId: TID, aliases: [] as string[] },
    ];
    // Act
    const { chunks } = buildAnalysisPostChunks(tickerId, entities, [], 10);
    // Assert
    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.entities).toHaveLength(2);
    expect(chunks[0]?.relations).toHaveLength(0);
  });

  it("reports parse error when chunk body fails schema validation", () => {
    // Act
    const { chunks, parseErrors } = buildAnalysisPostChunks(
      "",
      [
        {
          canonicalName: "A",
          typeId: TID,
          aliases: [],
        },
        {
          canonicalName: "B",
          typeId: TID,
          aliases: [],
        },
      ],
      [{ fromEntityName: "A", toEntityName: "B", relationTypeId: RID }],
      10,
    );

    // Assert
    expect(chunks).toHaveLength(0);
    expect(parseErrors.length).toBeGreaterThan(0);
  });
});
