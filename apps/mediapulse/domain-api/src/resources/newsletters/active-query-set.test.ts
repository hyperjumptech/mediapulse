import { describe, expect, it, vi } from "vitest";

import { findActiveQuerySetForNewsletter } from "./active-query-set";

describe("findActiveQuerySetForNewsletter", () => {
  it("resolves the point-in-time set without filtering on the current active flag", async () => {
    const findFirst = vi.fn().mockResolvedValue(null);

    const result = await findActiveQuerySetForNewsletter(
      "ticker-1",
      new Date("2026-05-14T12:00:00.000Z"),
      { searchQuerySet: { findFirst } },
    );

    expect(result).toBeNull();
    expect(findFirst).toHaveBeenCalledTimes(1);
    const args = findFirst.mock.calls[0]?.[0];
    expect(args).toMatchObject({
      where: {
        tickerId: "ticker-1",
        generatedAt: { lte: new Date("2026-05-14T12:00:00.000Z") },
      },
      orderBy: { generatedAt: "desc" },
    });
    expect(args?.where?.isActive).toBeUndefined();
  });

  it("builds stage KPIs from the set columns and its snapshot llmUsage", async () => {
    const generatedAt = new Date("2026-07-13T06:00:00.000Z");
    const findFirst = vi.fn().mockResolvedValue({
      id: "set-1",
      generatedAt,
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
    });

    const result = await findActiveQuerySetForNewsletter(
      "ticker-1",
      new Date("2026-07-14T12:00:00.000Z"),
      { searchQuerySet: { findFirst } },
    );

    expect(result).toStrictEqual({
      setId: "set-1",
      generatedAt: generatedAt.toISOString(),
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
    const findFirst = vi.fn().mockResolvedValue({
      id: "set-1",
      generatedAt: new Date("2026-07-13T06:00:00.000Z"),
      generationSource: "manual_strategy",
      agentId: null,
      agentVersion: null,
      strategySnapshot: {},
      searchQueries: [],
    });

    const result = await findActiveQuerySetForNewsletter(
      "ticker-1",
      new Date("2026-07-14T12:00:00.000Z"),
      { searchQuerySet: { findFirst } },
    );

    expect(result?.agentLabel).toBe("query-analysis");
    expect(result?.model).toBe("—");
    expect(result?.tokensTotalLabel).toBe("0");
  });

  it("returns queries in rank ascending order from Prisma", async () => {
    const generatedAt = new Date("2026-05-13T08:00:00.000Z");
    const findFirst = vi.fn().mockResolvedValue({
      id: "set-2",
      generatedAt,
      generationSource: "agent_generated",
      searchQueries: [
        {
          id: "q1",
          text: "first query",
          intent: "breaking",
          rank: 1,
        },
        {
          id: "q2",
          text: "second query",
          intent: "thematic",
          rank: 2,
        },
      ],
    });

    const result = await findActiveQuerySetForNewsletter(
      "ticker-1",
      new Date("2026-05-14T12:00:00.000Z"),
      { searchQuerySet: { findFirst } },
    );

    expect(result?.queries.map((q) => q.id)).toStrictEqual(["q1", "q2"]);
    expect(result?.queries[0]).toMatchObject({
      intent: "breaking",
      rank: 1,
    });
  });
});
