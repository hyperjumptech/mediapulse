/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@workspace/mediapulse-database", () => ({
  prisma: {
    dataSource: {
      findMany: vi.fn(),
    },
    newsletter: {
      create: vi.fn(),
    },
  },
}));

import { getDataSourcesForTicker } from "./content-generation";

type MockDb = {
  dataSource: {
    findMany: ReturnType<typeof vi.fn>;
  };
};

const createMockDb = (): MockDb => ({
  dataSource: {
    findMany: vi.fn(),
  },
});

type GetDataSourcesDeps = NonNullable<
  Parameters<typeof getDataSourcesForTicker>[1]
>;

describe("getDataSourcesForTicker", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("filters by selected relevance scored today in UTC and sorts by score desc", async () => {
    // Setup
    const db = createMockDb();
    db.dataSource.findMany.mockResolvedValue([
      {
        id: "ds-low",
        url: "https://example.com/low",
        title: "Low score",
        content: "Low",
        metadata: null,
        tickerId: "ticker-1",
        searchQueryId: "sq-1",
        createdAt: new Date("2026-03-19T08:00:00.000Z"),
        updatedAt: new Date("2026-03-19T08:00:00.000Z"),
        articleRelevances: [{ score: 0.62 }],
      },
      {
        id: "ds-high",
        url: "https://example.com/high",
        title: "High score",
        content: "High",
        metadata: null,
        tickerId: "ticker-1",
        searchQueryId: "sq-2",
        createdAt: new Date("2026-03-19T09:00:00.000Z"),
        updatedAt: new Date("2026-03-19T09:00:00.000Z"),
        articleRelevances: [{ score: 0.93 }],
      },
    ]);

    // Act
    const result = await getDataSourcesForTicker("ticker-1", {
      db: db as unknown as NonNullable<GetDataSourcesDeps["db"]>,
      now: () => new Date("2026-03-19T15:30:00.000Z"),
    });

    // Assert
    const expectedStartOfToday = new Date("2026-03-19T00:00:00.000Z");
    expect(db.dataSource.findMany).toHaveBeenCalledWith({
      where: {
        tickerId: "ticker-1",
        articleRelevances: {
          some: {
            tickerId: "ticker-1",
            selected: true,
            scoredAt: { gte: expectedStartOfToday },
          },
        },
      },
      include: {
        articleRelevances: {
          where: {
            tickerId: "ticker-1",
            selected: true,
            scoredAt: { gte: expectedStartOfToday },
          },
          select: {
            score: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
    expect(result).toHaveLength(2);
    expect(result[0]?.id).toBe("ds-high");
    expect(result[1]?.id).toBe("ds-low");
    expect(result[0]).not.toHaveProperty("articleRelevances");
  });

  it("returns an empty array when no selected articles exist for today", async () => {
    // Setup
    const db = createMockDb();
    db.dataSource.findMany.mockResolvedValue([]);

    // Act
    const result = await getDataSourcesForTicker("ticker-1", {
      db: db as unknown as NonNullable<GetDataSourcesDeps["db"]>,
      now: () => new Date("2026-03-19T02:00:00.000Z"),
    });

    // Assert
    expect(result).toEqual([]);
  });
});
