/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@mediapulse/database", () => ({
  prisma: {
    dataSource: {
      findMany: vi.fn(),
    },
    newsletter: {
      create: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));

import {
  getDataSourcesForTicker,
  getLatestNewsletter,
} from "./content-generation";

type MockDb = {
  dataSource: {
    findMany: ReturnType<typeof vi.fn>;
  };
  newsletter: {
    create: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
  };
};

const createMockDb = (): MockDb => ({
  dataSource: {
    findMany: vi.fn(),
  },
  newsletter: {
    create: vi.fn(),
    findFirst: vi.fn(),
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

describe("getLatestNewsletter", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns hasNewsletter:true and newsletterId when a newsletter exists in the window", async () => {
    // Setup
    const db = createMockDb();
    db.newsletter.findFirst.mockResolvedValue({
      id: "nl-123",
    });

    // Act
    const result = await getLatestNewsletter(
      "ticker-1",
      "2026-04-20T00:00:00.000Z",
      "2026-04-21T00:00:00.000Z",
      db as unknown as Parameters<typeof getLatestNewsletter>[3],
    );

    // Assert
    expect(result).toEqual({
      hasNewsletter: true,
      newsletterId: "nl-123",
    });
    expect(db.newsletter.findFirst).toHaveBeenCalledWith({
      where: {
        tickerId: "ticker-1",
        createdAt: {
          gte: new Date("2026-04-20T00:00:00.000Z"),
          lt: new Date("2026-04-21T00:00:00.000Z"),
        },
      },
      select: { id: true },
      orderBy: { createdAt: "desc" },
    });
  });

  it("returns hasNewsletter:false and null newsletterId when no newsletter exists in the window", async () => {
    // Setup
    const db = createMockDb();
    db.newsletter.findFirst.mockResolvedValue(null);

    // Act
    const result = await getLatestNewsletter(
      "ticker-1",
      "2026-04-20T00:00:00.000Z",
      "2026-04-21T00:00:00.000Z",
      db as unknown as Parameters<typeof getLatestNewsletter>[3],
    );

    // Assert
    expect(result).toEqual({
      hasNewsletter: false,
      newsletterId: null,
    });
  });

  it("returns hasNewsletter:false when newsletter exists but outside the window", async () => {
    // Setup
    const db = createMockDb();
    db.newsletter.findFirst.mockResolvedValue(null);

    // Act
    const result = await getLatestNewsletter(
      "ticker-1",
      "2026-04-20T17:00:00.000Z",
      "2026-04-21T17:00:00.000Z",
      db as unknown as Parameters<typeof getLatestNewsletter>[3],
    );

    // Assert — findFirst returns null because window filters out the old newsletter
    expect(result).toEqual({
      hasNewsletter: false,
      newsletterId: null,
    });
    expect(db.newsletter.findFirst).toHaveBeenCalledWith({
      where: {
        tickerId: "ticker-1",
        createdAt: {
          gte: new Date("2026-04-20T17:00:00.000Z"),
          lt: new Date("2026-04-21T17:00:00.000Z"),
        },
      },
      select: { id: true },
      orderBy: { createdAt: "desc" },
    });
  });
});
