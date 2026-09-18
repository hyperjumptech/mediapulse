/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";

import { buildKnowledgeArticleCounts } from "./list-aggregates";

describe("buildKnowledgeArticleCounts", () => {
  it("counts an article once however many entities it names", async () => {
    const findMany = vi.fn().mockResolvedValue([
      { tickerId: "a", dataSourceId: "article-1" },
      { tickerId: "a", dataSourceId: "article-2" },
      { tickerId: "b", dataSourceId: "article-1" },
    ]);

    const counts = await buildKnowledgeArticleCounts(["a", "b"], {
      knowledgeEntityMention: { findMany },
    });

    expect(counts.get("a")).toBe(2);
    expect(counts.get("b")).toBe(1);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ distinct: ["tickerId", "dataSourceId"] }),
    );
  });

  it("reports zero for a ticker with no mentions", async () => {
    const findMany = vi.fn().mockResolvedValue([]);

    const counts = await buildKnowledgeArticleCounts(["a"], {
      knowledgeEntityMention: { findMany },
    });

    expect(counts.get("a")).toBe(0);
  });

  it("asks nothing of the database for an empty page", async () => {
    const findMany = vi.fn();

    const counts = await buildKnowledgeArticleCounts([], {
      knowledgeEntityMention: { findMany },
    });

    expect(counts.size).toBe(0);
    expect(findMany).not.toHaveBeenCalled();
  });
});
