import { describe, expect, it, vi } from "vitest";

import { findActiveQuerySetForNewsletter } from "./active-query-set";

describe("findActiveQuerySetForNewsletter", () => {
  it("returns null when no active set exists", async () => {
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
        isActive: true,
        generatedAt: { lte: new Date("2026-05-14T12:00:00.000Z") },
      },
      orderBy: { generatedAt: "desc" },
    });
  });

  it("maps queries with rank/intent and supports empty sets", async () => {
    const generatedAt = new Date("2026-05-13T08:00:00.000Z");
    const findFirst = vi.fn().mockResolvedValue({
      id: "set-1",
      generatedAt,
      generationSource: "manual_strategy",
      searchQueries: [],
    });

    const result = await findActiveQuerySetForNewsletter(
      "ticker-1",
      new Date("2026-05-14T12:00:00.000Z"),
      { searchQuerySet: { findFirst } },
    );

    expect(result).toStrictEqual({
      setId: "set-1",
      generatedAt: generatedAt.toISOString(),
      generationSource: "manual_strategy",
      queries: [],
    });
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
