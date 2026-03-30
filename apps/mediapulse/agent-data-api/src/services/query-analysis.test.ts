/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@mediapulse/database", () => ({
  prisma: {
    ticker: { findUnique: vi.fn() },
    tickerEntity: { findMany: vi.fn() },
    dataSource: { findMany: vi.fn() },
    articleEntity: { groupBy: vi.fn() },
    entity: { findMany: vi.fn() },
    searchQuerySet: { create: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
    searchQuery: { createMany: vi.fn() },
  },
}));

import { getQueryAnalysisContext, persistQuerySet } from "./query-analysis.js";

const TICKER_ID = "11111111-1111-4111-a111-111111111111";

const makeTicker = () => ({
  id: TICKER_ID,
  symbol: "AAPL",
  name: "Apple Inc.",
  metadata: null,
});

const makeDb = () => ({
  ticker: { findUnique: vi.fn() },
  tickerEntity: { findMany: vi.fn() },
  dataSource: { findMany: vi.fn() },
  articleEntity: { groupBy: vi.fn() },
  entity: { findMany: vi.fn() },
  searchQuerySet: {
    create: vi.fn(),
    updateMany: vi.fn(),
    update: vi.fn(),
  },
  searchQuery: { createMany: vi.fn() },
});

describe("getQueryAnalysisContext", () => {
  afterEach(() => vi.restoreAllMocks());

  it("returns null when ticker does not exist", async () => {
    const db = makeDb();
    db.ticker.findUnique.mockResolvedValue(null);

    const result = await getQueryAnalysisContext(TICKER_ID, db as never);

    expect(result).toBeNull();
  });

  it("returns ticker, topEntities and empty recentThemes when no recent sources", async () => {
    const db = makeDb();
    db.ticker.findUnique.mockResolvedValue(makeTicker());
    db.tickerEntity.findMany.mockResolvedValue([
      {
        relevanceWeight: 0.9,
        entity: { canonicalName: "Tim Cook", type: { name: "Person" } },
      },
    ]);
    db.dataSource.findMany.mockResolvedValue([]); // no recent sources

    const result = await getQueryAnalysisContext(TICKER_ID, db as never);

    expect(result).not.toBeNull();
    expect(result!.ticker.symbol).toBe("AAPL");
    expect(result!.topEntities).toHaveLength(1);
    expect(result!.topEntities[0]!.canonicalName).toBe("Tim Cook");
    expect(result!.recentThemes).toHaveLength(0);
  });

  it("aggregates recent themes from article entities", async () => {
    const db = makeDb();
    db.ticker.findUnique.mockResolvedValue(makeTicker());
    db.tickerEntity.findMany.mockResolvedValue([]);
    db.dataSource.findMany.mockResolvedValue([{ id: "ds-1" }, { id: "ds-2" }]);
    db.articleEntity.groupBy.mockResolvedValue([
      { entityId: "e-1", _sum: { mentionCount: 5 } },
      { entityId: "e-2", _sum: { mentionCount: 3 } },
    ]);
    db.entity.findMany.mockResolvedValue([
      { id: "e-1", canonicalName: "iPhone" },
      { id: "e-2", canonicalName: "App Store" },
    ]);

    const result = await getQueryAnalysisContext(TICKER_ID, db as never);

    expect(result!.recentThemes).toHaveLength(2);
    expect(result!.recentThemes[0]!.theme).toBe("iPhone");
    expect(result!.recentThemes[0]!.articleCount).toBe(5);
    expect(result!.recentThemes[1]!.theme).toBe("App Store");
  });

  it("falls back to entityId as theme name when entity is not found in lookup", async () => {
    const db = makeDb();
    db.ticker.findUnique.mockResolvedValue(makeTicker());
    db.tickerEntity.findMany.mockResolvedValue([]);
    db.dataSource.findMany.mockResolvedValue([{ id: "ds-1" }]);
    db.articleEntity.groupBy.mockResolvedValue([
      { entityId: "e-unknown", _sum: { mentionCount: 7 } },
    ]);
    db.entity.findMany.mockResolvedValue([]); // entity not found

    const result = await getQueryAnalysisContext(TICKER_ID, db as never);

    expect(result!.recentThemes).toHaveLength(1);
    expect(result!.recentThemes[0]!.theme).toBe("e-unknown");
    expect(result!.recentThemes[0]!.articleCount).toBe(7);
  });

  it("treats null mentionCount sum as zero articleCount", async () => {
    const db = makeDb();
    db.ticker.findUnique.mockResolvedValue(makeTicker());
    db.tickerEntity.findMany.mockResolvedValue([]);
    db.dataSource.findMany.mockResolvedValue([{ id: "ds-1" }]);
    db.articleEntity.groupBy.mockResolvedValue([
      { entityId: "e-1", _sum: { mentionCount: null } },
    ]);
    db.entity.findMany.mockResolvedValue([
      { id: "e-1", canonicalName: "Mac" },
    ]);

    const result = await getQueryAnalysisContext(TICKER_ID, db as never);

    expect(result!.recentThemes[0]!.articleCount).toBe(0);
  });

  it("maps topEntities with correct shape", async () => {
    const db = makeDb();
    db.ticker.findUnique.mockResolvedValue(makeTicker());
    db.tickerEntity.findMany.mockResolvedValue([
      {
        relevanceWeight: 0.75,
        entity: { canonicalName: "Cupertino", type: { name: "Location" } },
      },
      {
        relevanceWeight: 0.5,
        entity: { canonicalName: "iOS", type: { name: "Product" } },
      },
    ]);
    db.dataSource.findMany.mockResolvedValue([]);

    const result = await getQueryAnalysisContext(TICKER_ID, db as never);

    expect(result!.topEntities[0]).toEqual({
      canonicalName: "Cupertino",
      typeName: "Location",
      relevanceWeight: 0.75,
    });
    expect(result!.topEntities[1]).toEqual({
      canonicalName: "iOS",
      typeName: "Product",
      relevanceWeight: 0.5,
    });
  });

  it("skips groupBy when recentSources is empty", async () => {
    const db = makeDb();
    db.ticker.findUnique.mockResolvedValue(makeTicker());
    db.tickerEntity.findMany.mockResolvedValue([]);
    db.dataSource.findMany.mockResolvedValue([]);

    await getQueryAnalysisContext(TICKER_ID, db as never);

    expect(db.articleEntity.groupBy).not.toHaveBeenCalled();
  });
});

describe("persistQuerySet", () => {
  afterEach(() => vi.restoreAllMocks());

  const makeBody = () => ({
    tickerId: TICKER_ID,
    queries: [
      { text: "AAPL latest news", source: "deterministic" as const, intent: "breaking" as const, rank: 1 },
      { text: "Apple earnings guidance", source: "deterministic" as const, intent: "fundamental" as const, rank: 2 },
    ],
    strategySnapshot: { queryCount: 12, model: "gpt-4o-mini" },
    generationSource: "hybrid_v1",
    agentJobId: "job-abc",
  });

  it("creates set, bulk-inserts queries, deactivates previous sets, and activates new set", async () => {
    const db = makeDb();
    const newSetId = "set-111";
    db.searchQuerySet.create.mockResolvedValue({ id: newSetId });
    db.searchQuery.createMany.mockResolvedValue({ count: 2 });
    db.searchQuerySet.updateMany.mockResolvedValue({ count: 1 });
    db.searchQuerySet.update.mockResolvedValue({ id: newSetId, isActive: true });

    const result = await persistQuerySet(makeBody(), db as never);

    expect(db.searchQuerySet.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tickerId: TICKER_ID, isActive: false, agentJobId: "job-abc" }),
      }),
    );
    expect(db.searchQuery.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ text: "AAPL latest news", source: "DETERMINISTIC", intent: "BREAKING", rank: 1 }),
        ]),
      }),
    );
    expect(db.searchQuerySet.updateMany).toHaveBeenCalledWith({
      where: { tickerId: TICKER_ID, isActive: true },
      data: { isActive: false },
    });
    expect(db.searchQuerySet.update).toHaveBeenCalledWith({
      where: { id: newSetId },
      data: { isActive: true },
    });
    expect(result).toEqual({ created: 2, setId: newSetId, activeSetId: newSetId });
  });

  it("stores null agentJobId when not provided", async () => {
    const db = makeDb();
    db.searchQuerySet.create.mockResolvedValue({ id: "set-222" });
    db.searchQuery.createMany.mockResolvedValue({ count: 0 });
    db.searchQuerySet.updateMany.mockResolvedValue({ count: 0 });
    db.searchQuerySet.update.mockResolvedValue({ id: "set-222" });

    const body = { ...makeBody(), agentJobId: undefined, queries: [] };
    await persistQuerySet(body, db as never);

    expect(db.searchQuerySet.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ agentJobId: null }) }),
    );
  });

  it("maps llm source to LLM enum value", async () => {
    const db = makeDb();
    db.searchQuerySet.create.mockResolvedValue({ id: "set-333" });
    db.searchQuery.createMany.mockResolvedValue({ count: 1 });
    db.searchQuerySet.updateMany.mockResolvedValue({ count: 0 });
    db.searchQuerySet.update.mockResolvedValue({ id: "set-333" });

    const body = {
      ...makeBody(),
      queries: [
        { text: "LLM query", source: "llm" as const, intent: "kg_change" as const, rank: 1 },
      ],
    };
    await persistQuerySet(body, db as never);

    expect(db.searchQuery.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ source: "LLM", intent: "KG_CHANGE" }),
        ]),
      }),
    );
  });

  it("maps kg_change intent to KG_CHANGE enum value", async () => {
    const db = makeDb();
    db.searchQuerySet.create.mockResolvedValue({ id: "set-444" });
    db.searchQuery.createMany.mockResolvedValue({ count: 1 });
    db.searchQuerySet.updateMany.mockResolvedValue({ count: 0 });
    db.searchQuerySet.update.mockResolvedValue({ id: "set-444" });

    const body = {
      ...makeBody(),
      queries: [
        { text: "KG query", source: "deterministic" as const, intent: "kg_change" as const, rank: 3 },
      ],
    };
    await persistQuerySet(body, db as never);

    expect(db.searchQuery.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ intent: "KG_CHANGE", rank: 3 }),
        ]),
      }),
    );
  });

  it("returns created count equal to number of queries in body", async () => {
    const db = makeDb();
    db.searchQuerySet.create.mockResolvedValue({ id: "set-555" });
    db.searchQuery.createMany.mockResolvedValue({ count: 3 });
    db.searchQuerySet.updateMany.mockResolvedValue({ count: 0 });
    db.searchQuerySet.update.mockResolvedValue({ id: "set-555" });

    const body = {
      ...makeBody(),
      queries: [
        { text: "q1", source: "deterministic" as const, intent: "breaking" as const, rank: 1 },
        { text: "q2", source: "llm" as const, intent: "fundamental" as const, rank: 2 },
        { text: "q3", source: "llm" as const, intent: "kg_change" as const, rank: 3 },
      ],
    };

    const result = await persistQuerySet(body, db as never);

    expect(result.created).toBe(3);
  });

  it("sets isActive false on create and then activates via update", async () => {
    const db = makeDb();
    const setId = "set-666";
    db.searchQuerySet.create.mockResolvedValue({ id: setId });
    db.searchQuery.createMany.mockResolvedValue({ count: 0 });
    db.searchQuerySet.updateMany.mockResolvedValue({ count: 2 });
    db.searchQuerySet.update.mockResolvedValue({ id: setId, isActive: true });

    await persistQuerySet({ ...makeBody(), queries: [] }, db as never);

    const createCall = db.searchQuerySet.create.mock.calls[0]![0] as { data: { isActive: boolean } };
    expect(createCall.data.isActive).toBe(false);

    const updateCall = db.searchQuerySet.update.mock.calls[0]![0] as { data: { isActive: boolean } };
    expect(updateCall.data.isActive).toBe(true);
  });
});
