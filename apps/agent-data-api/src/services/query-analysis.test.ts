/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@workspace/database", () => ({
  prisma: {},
}));

const getService = () => import("./query-analysis.js");

const tickerId = "11111111-1111-4111-a111-111111111111";

const createDb = () => ({
  ticker: {
    findUnique: vi.fn(),
  },
  tickerEntity: {
    findMany: vi.fn(),
  },
  articleEntity: {
    groupBy: vi.fn(),
  },
  entity: {
    findMany: vi.fn(),
  },
  searchQuery: {
    deleteMany: vi.fn(),
    createMany: vi.fn(),
  },
});

describe("query-analysis service", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns ticker context with top entities and recent themes", async () => {
    // Setup
    const db = createDb();
    db.ticker.findUnique.mockResolvedValue({
      id: tickerId,
      symbol: "DSSA",
      name: "Dian Swastatika Sentosa",
      metadata: { sektor: "Energi" },
    });
    db.tickerEntity.findMany.mockResolvedValue([
      {
        relevanceWeight: 0.95,
        entity: {
          canonicalName: "Golden Energy Mines",
          type: { name: "COMPANY" },
        },
      },
    ]);
    db.articleEntity.groupBy.mockResolvedValue([
      {
        entityId: "ent-topic",
        _count: { entityId: 4 },
      },
    ]);
    db.entity.findMany.mockResolvedValue([
      { id: "ent-topic", canonicalName: "Domestic Market Obligation" },
    ]);

    // Act
    const service = await getService();
    const result = await service.getQueryAnalysisData(tickerId, db);

    // Assert
    expect(result.ticker.symbol).toBe("DSSA");
    expect(result.topEntities).toEqual([
      {
        canonicalName: "Golden Energy Mines",
        typeName: "COMPANY",
        relevanceWeight: 0.95,
      },
    ]);
    expect(result.recentThemes).toEqual([
      { theme: "Domestic Market Obligation", articleCount: 4 },
    ]);
    expect(db.tickerEntity.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 20 }),
    );
  });

  it("returns empty arrays when no entities or themes exist", async () => {
    // Setup
    const db = createDb();
    db.ticker.findUnique.mockResolvedValue({
      id: tickerId,
      symbol: "DSSA",
      name: "DSSA",
      metadata: null,
    });
    db.tickerEntity.findMany.mockResolvedValue([]);
    db.articleEntity.groupBy.mockResolvedValue([]);

    // Act
    const service = await getService();
    const result = await service.getQueryAnalysisData(tickerId, db);

    // Assert
    expect(result.topEntities).toEqual([]);
    expect(result.recentThemes).toEqual([]);
    expect(db.entity.findMany).not.toHaveBeenCalled();
  });

  it("throws when ticker does not exist", async () => {
    // Setup
    const db = createDb();
    db.ticker.findUnique.mockResolvedValue(null);
    db.tickerEntity.findMany.mockResolvedValue([]);
    db.articleEntity.groupBy.mockResolvedValue([]);

    // Act & Assert
    const service = await getService();
    await expect(service.getQueryAnalysisData(tickerId, db)).rejects.toThrow(
      "Ticker 11111111-1111-4111-a111-111111111111 not found",
    );
  });

  it("cleans stale queries and creates new rows", async () => {
    // Setup
    const db = createDb();
    db.searchQuery.deleteMany.mockResolvedValue({ count: 2 });
    db.searchQuery.createMany.mockResolvedValue({ count: 3 });
    const data = {
      tickerId,
      queries: [{ text: "q1" }, { text: "q2" }, { text: "q3" }],
    };

    // Act
    const service = await getService();
    const result = await service.createSearchQueries(data, db);

    // Assert
    expect(result).toEqual({ created: 3 });
    expect(db.searchQuery.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tickerId,
          createdAt: expect.objectContaining({ lt: expect.any(Date) }),
        }),
      }),
    );
    expect(db.searchQuery.createMany).toHaveBeenCalledWith({
      data: [
        { text: "q1", tickerId },
        { text: "q2", tickerId },
        { text: "q3", tickerId },
      ],
    });
  });

  it("returns zero created when query list is empty", async () => {
    // Setup
    const db = createDb();
    db.searchQuery.deleteMany.mockResolvedValue({ count: 1 });

    // Act
    const service = await getService();
    const result = await service.createSearchQueries(
      { tickerId, queries: [] },
      db,
    );

    // Assert
    expect(result).toEqual({ created: 0 });
    expect(db.searchQuery.createMany).not.toHaveBeenCalled();
  });
});
