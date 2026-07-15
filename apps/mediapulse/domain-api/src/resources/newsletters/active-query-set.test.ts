import { describe, expect, it, vi } from "vitest";

import { findQuerySetForNewsletter } from "./active-query-set";

const querySetRow = (overrides: Record<string, unknown> = {}) => ({
  id: "set-1",
  generatedAt: new Date("2026-07-13T06:00:00.000Z"),
  generationSource: "self_driving_v1",
  agentId: "query-analysis",
  agentVersion: "3.0.0",
  strategySnapshot: {
    llmUsage: {
      model: "openai/gpt-4.1-mini",
      promptTokens: 1234,
      completionTokens: 567,
      reasoningTokens: 8,
      totalTokens: 1809,
    },
  },
  searchQueries: [],
  ...overrides,
});

describe("findQuerySetForNewsletter", () => {
  it("returns null and does not query when the newsletter has no linked set", async () => {
    const findUnique = vi.fn();

    const result = await findQuerySetForNewsletter(null, {
      searchQuerySet: { findUnique },
    });

    expect(result).toBeNull();
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("returns null when the linked set is missing", async () => {
    const findUnique = vi.fn().mockResolvedValue(null);

    const result = await findQuerySetForNewsletter("set-x", {
      searchQuerySet: { findUnique },
    });

    expect(result).toBeNull();
    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "set-x" } }),
    );
  });

  it("builds stage KPIs from the linked set columns and snapshot llmUsage", async () => {
    const findUnique = vi.fn().mockResolvedValue(querySetRow());

    const result = await findQuerySetForNewsletter("set-1", {
      searchQuerySet: { findUnique },
    });

    expect(result).toStrictEqual({
      setId: "set-1",
      generatedAt: new Date("2026-07-13T06:00:00.000Z").toISOString(),
      generationSource: "self_driving_v1",
      agentLabel: "query-analysis - 3.0.0",
      generatedAtLabel: "July 13, 2026 at 13:00",
      model: "openai/gpt-4.1-mini",
      tokensTotalLabel: "1.8K",
      tokensBreakdownLabel: "Input 1,234 · Output 567 · Reasoning 8",
      queries: [],
    });
  });

  it("falls back to a bare agent label and em dash model when unrecorded", async () => {
    const findUnique = vi.fn().mockResolvedValue(
      querySetRow({
        agentId: null,
        agentVersion: null,
        strategySnapshot: {},
      }),
    );

    const result = await findQuerySetForNewsletter("set-1", {
      searchQuerySet: { findUnique },
    });

    expect(result?.agentLabel).toBe("query-analysis");
    expect(result?.model).toBe("—");
    expect(result?.tokensTotalLabel).toBe("0");
  });

  it("orders queries by rank then created time", async () => {
    const findUnique = vi.fn().mockResolvedValue(
      querySetRow({
        searchQueries: [
          {
            id: "q2",
            text: "second",
            intent: "thematic",
            rank: 2,
            createdAt: new Date("2026-05-13T08:00:00.000Z"),
          },
          {
            id: "q1",
            text: "first",
            intent: "breaking",
            rank: 1,
            createdAt: new Date("2026-05-13T08:00:00.000Z"),
          },
        ],
      }),
    );

    const result = await findQuerySetForNewsletter("set-1", {
      searchQuerySet: { findUnique },
    });

    expect(result?.queries.map((query) => query.id)).toStrictEqual([
      "q1",
      "q2",
    ]);
  });
});
