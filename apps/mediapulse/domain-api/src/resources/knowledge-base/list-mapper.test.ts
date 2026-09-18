/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import { mapRowToListItem, type KnowledgeBaseListRow } from "./list-mapper";

const row = (
  overrides: Partial<{
    entityCount: number;
    relationCount: number;
    lastSeenAt: Date | null;
  }> = {},
): KnowledgeBaseListRow =>
  ({
    id: "ticker-1",
    symbol: "FORE",
    name: "Fore Kopi Indonesia",
    _count: {
      knowledgeTickerEntities: overrides.entityCount ?? 14,
      knowledgeTickerRelations: overrides.relationCount ?? 13,
    },
    knowledgeTickerEntities:
      overrides.lastSeenAt === null
        ? []
        : [
            {
              lastSeenAt:
                overrides.lastSeenAt ?? new Date("2026-09-16T00:00:00.000Z"),
            },
          ],
  }) as unknown as KnowledgeBaseListRow;

describe("mapRowToListItem", () => {
  it("carries the ticker id as the row id, so the detail page opens the issuer", () => {
    const item = mapRowToListItem(row(), 42);

    expect(item.id).toBe("ticker-1");
    expect(item.symbol).toBe("FORE");
    expect(item.articleCount).toBe(42);
  });

  it("reads the counts off the membership tables", () => {
    const item = mapRowToListItem(row({ entityCount: 3, relationCount: 2 }), 0);

    expect(item.entityCount).toBe(3);
    expect(item.relationCount).toBe(2);
  });

  it("reports no last-seen time for a knowledge base with no entities", () => {
    const item = mapRowToListItem(row({ lastSeenAt: null }), 0);

    expect(item.lastSeenAt).toBeNull();
  });
});
