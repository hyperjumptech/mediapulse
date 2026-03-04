/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import { getTickerById, getTickersPage } from "./tickers";
import type { PrismaClientWithSchema } from "@workspace/database/client";

type MockDb = {
  ticker: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
};

const createMockDb = (): MockDb => ({
  ticker: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn(),
  },
});

const asDb = (db: MockDb): PrismaClientWithSchema =>
  db as unknown as PrismaClientWithSchema;

describe("getTickersPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls findMany with skip, take, orderBy and count", async () => {
    const db = createMockDb();
    db.ticker.findMany.mockResolvedValue([]);
    db.ticker.count.mockResolvedValue(0);

    await getTickersPage(2, 10, undefined, asDb(db));

    expect(db.ticker.findMany).toHaveBeenCalledWith({
      where: undefined,
      skip: 10,
      take: 10,
      orderBy: { symbol: "asc" },
    });
    expect(db.ticker.count).toHaveBeenCalledWith({ where: undefined });
  });

  it("returns tickers, total, page, pageSize", async () => {
    const db = createMockDb();
    const tickers = [
      {
        id: "t1",
        symbol: "AAPL",
        name: "Apple",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    db.ticker.findMany.mockResolvedValue(tickers);
    db.ticker.count.mockResolvedValue(1);

    const result = await getTickersPage(1, 10, undefined, asDb(db));

    expect(result).toEqual({
      tickers,
      total: 1,
      page: 1,
      pageSize: 10,
    });
  });

  it("returns empty list when no tickers", async () => {
    const db = createMockDb();
    db.ticker.findMany.mockResolvedValue([]);
    db.ticker.count.mockResolvedValue(0);

    const result = await getTickersPage(1, 20, undefined, asDb(db));

    expect(result.tickers).toHaveLength(0);
    expect(result.total).toBe(0);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
  });

  it("applies search filter on symbol and name when search option provided", async () => {
    const db = createMockDb();
    db.ticker.findMany.mockResolvedValue([]);
    db.ticker.count.mockResolvedValue(0);

    await getTickersPage(1, 10, { search: "apple" }, asDb(db));

    const expectedWhere = {
      OR: [
        { symbol: { contains: "apple", mode: "insensitive" } },
        { name: { contains: "apple", mode: "insensitive" } },
      ],
    };
    expect(db.ticker.findMany).toHaveBeenCalledWith({
      where: expectedWhere,
      skip: 0,
      take: 10,
      orderBy: { symbol: "asc" },
    });
    expect(db.ticker.count).toHaveBeenCalledWith({ where: expectedWhere });
  });

  it("ignores empty or whitespace-only search", async () => {
    const db = createMockDb();
    db.ticker.findMany.mockResolvedValue([]);
    db.ticker.count.mockResolvedValue(0);

    await getTickersPage(1, 10, { search: "   " }, asDb(db));

    expect(db.ticker.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: undefined }),
    );
    expect(db.ticker.count).toHaveBeenCalledWith({ where: undefined });
  });
});

describe("getTickerById", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls findUnique with id", async () => {
    const db = createMockDb();
    db.ticker.findUnique.mockResolvedValue(null);

    await getTickerById("tid-1", asDb(db));

    expect(db.ticker.findUnique).toHaveBeenCalledWith({
      where: { id: "tid-1" },
    });
  });

  it("returns ticker when found", async () => {
    const db = createMockDb();
    const ticker = {
      id: "t1",
      symbol: "GOOG",
      name: "Alphabet",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    db.ticker.findUnique.mockResolvedValue(ticker);

    const result = await getTickerById("t1", asDb(db));

    expect(result).toEqual(ticker);
  });

  it("returns null when not found", async () => {
    const db = createMockDb();
    db.ticker.findUnique.mockResolvedValue(null);

    const result = await getTickerById("missing", asDb(db));

    expect(result).toBeNull();
  });
});
