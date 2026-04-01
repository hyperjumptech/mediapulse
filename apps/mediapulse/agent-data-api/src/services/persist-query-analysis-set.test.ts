/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";

import type { PostQueryAnalysisBody } from "@workspace/agent-data-api-contract";

import {
  dedupeQueryItems,
  normalizeQueryTextKey,
  persistQueryAnalysisSet,
} from "./persist-query-analysis-set.js";

describe("normalizeQueryTextKey", () => {
  it("normalizes spacing and case", () => {
    expect(normalizeQueryTextKey("  Foo   BAR ")).toBe("foo bar");
  });
});

describe("dedupeQueryItems", () => {
  it("drops duplicate normalized texts keeping first order", () => {
    const body: PostQueryAnalysisBody["queries"] = [
      {
        text: "Same",
        source: "deterministic",
        intent: "breaking",
        rank: 0,
      },
      {
        text: "  same ",
        source: "llm",
        intent: "fundamental",
        rank: 1,
      },
    ];

    expect(dedupeQueryItems(body)).toHaveLength(1);
    expect(dedupeQueryItems(body)[0]?.source).toBe("deterministic");
  });
});

describe("persistQueryAnalysisSet", () => {
  it("throws TICKER_NOT_FOUND when ticker is missing", async () => {
    const prisma = {
      ticker: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
      $transaction: vi.fn(),
    };

    const body: PostQueryAnalysisBody = {
      tickerId: "missing",
      queries: [],
      strategySnapshot: {},
      generationSource: "hybrid_v1",
      activate: true,
    };

    await expect(
      persistQueryAnalysisSet(
        prisma as unknown as Parameters<typeof persistQueryAnalysisSet>[0],
        body,
      ),
    ).rejects.toThrow("TICKER_NOT_FOUND");
  });
});
