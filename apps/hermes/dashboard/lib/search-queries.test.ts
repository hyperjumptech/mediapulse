/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

import { getSearchQueriesPage } from "./search-queries";

type MockDb = {
  searchQuery: {
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
};

const createMockDb = (): MockDb => ({
  searchQuery: {
    findMany: vi.fn(),
    count: vi.fn(),
  },
});

const asDb = (db: MockDb) => db as never;

describe("getSearchQueriesPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches rows with default ordering and pagination", async () => {
    // Setup
    const db = createMockDb();
    db.searchQuery.findMany.mockResolvedValue([]);
    db.searchQuery.count.mockResolvedValue(0);

    // Act
    await getSearchQueriesPage(2, 10, undefined, asDb(db));

    // Assert
    expect(db.searchQuery.findMany).toHaveBeenCalledWith({
      where: undefined,
      include: {
        ticker: {
          select: {
            name: true,
            symbol: true,
          },
        },
      },
      skip: 10,
      take: 10,
      orderBy: { createdAt: "desc" },
    });
    expect(db.searchQuery.count).toHaveBeenCalledWith({ where: undefined });
  });

  it("filters by ticker name when tickerNameFilter is provided", async () => {
    // Setup
    const db = createMockDb();
    db.searchQuery.findMany.mockResolvedValue([]);
    db.searchQuery.count.mockResolvedValue(0);

    // Act
    await getSearchQueriesPage(1, 15, { tickerNameFilter: "apple" }, asDb(db));

    // Assert
    const expectedWhere = {
      ticker: {
        name: { contains: "apple", mode: "insensitive" },
      },
    };
    expect(db.searchQuery.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expectedWhere }),
    );
    expect(db.searchQuery.count).toHaveBeenCalledWith({ where: expectedWhere });
  });

  it("ignores empty ticker-name filter values", async () => {
    // Setup
    const db = createMockDb();
    db.searchQuery.findMany.mockResolvedValue([]);
    db.searchQuery.count.mockResolvedValue(0);

    // Act
    await getSearchQueriesPage(1, 15, { tickerNameFilter: "   " }, asDb(db));

    // Assert
    expect(db.searchQuery.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: undefined }),
    );
    expect(db.searchQuery.count).toHaveBeenCalledWith({ where: undefined });
  });

  it("returns rows and pagination metadata", async () => {
    // Setup
    const db = createMockDb();
    const rows = [
      {
        id: "q1",
        text: "latest apple earnings",
        tickerId: "t1",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        ticker: {
          name: "Apple Inc.",
          symbol: "AAPL",
        },
      },
    ];
    db.searchQuery.findMany.mockResolvedValue(rows);
    db.searchQuery.count.mockResolvedValue(1);

    // Act
    const result = await getSearchQueriesPage(1, 15, undefined, asDb(db));

    // Assert
    expect(result).toEqual({
      searchQueries: rows,
      total: 1,
      page: 1,
      pageSize: 15,
    });
  });
});
