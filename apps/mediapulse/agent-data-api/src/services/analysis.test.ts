/** @vitest-environment node */
import {
  ANALYSIS_GET_DATA_SOURCE_LIMIT_MAX,
  getAnalysisQuerySchema,
} from "@workspace/agent-data-api-contract";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@mediapulse/database", () => ({
  prisma: {},
}));

let AnalysisPostValidationError: typeof import("./analysis.js").AnalysisPostValidationError;
let applyAnalysisPost: typeof import("./analysis.js").applyAnalysisPost;
let loadAnalysisContext: typeof import("./analysis.js").loadAnalysisContext;
let normalizeAnalysisName: typeof import("./analysis.js").normalizeAnalysisName;

beforeAll(async () => {
  const mod = await import("./analysis.js");
  AnalysisPostValidationError = mod.AnalysisPostValidationError;
  applyAnalysisPost = mod.applyAnalysisPost;
  loadAnalysisContext = mod.loadAnalysisContext;
  normalizeAnalysisName = mod.normalizeAnalysisName;
});

describe("normalizeAnalysisName", () => {
  it("trims and lowercases", () => {
    expect(normalizeAnalysisName("  Acme Corp  ")).toBe("acme corp");
  });
});

describe("getAnalysisQuerySchema", () => {
  it("rejects when start is after end", () => {
    const result = getAnalysisQuerySchema.safeParse({
      tickerId: "ticker-1",
      unanalyzed: "true",
      start: "2026-02-01T00:00:00.000Z",
      end: "2026-01-01T00:00:00.000Z",
    });
    expect(result.success).toBe(false);
  });

  it("treats empty string bounds as omitted", () => {
    const parsed = getAnalysisQuerySchema.parse({
      tickerId: "ticker-1",
      start: "",
      end: "",
    });
    expect(parsed.start).toBeUndefined();
    expect(parsed.end).toBeUndefined();
  });

  it("accepts start without end", () => {
    const parsed = getAnalysisQuerySchema.parse({
      tickerId: "ticker-1",
      start: "2026-01-01T00:00:00.000Z",
    });
    expect(parsed.start).toBe("2026-01-01T00:00:00.000Z");
    expect(parsed.end).toBeUndefined();
    expect(parsed.unanalyzed).toBe(true);
  });

  it("accepts limit as coerced positive int", () => {
    const parsed = getAnalysisQuerySchema.parse({
      tickerId: "ticker-1",
      limit: "10",
    });
    expect(parsed.limit).toBe(10);
  });

  it("rejects limit above max", () => {
    const result = getAnalysisQuerySchema.safeParse({
      tickerId: "ticker-1",
      limit: ANALYSIS_GET_DATA_SOURCE_LIMIT_MAX + 1,
    });
    expect(result.success).toBe(false);
  });
});

describe("loadAnalysisContext", () => {
  it("requests unanalyzed sources when unanalyzed is true", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const db = {
      dataSource: { findMany, findUnique: vi.fn(), findFirst: vi.fn() },
      entityType: { findMany: vi.fn().mockResolvedValue([]) },
      relationType: { findMany: vi.fn().mockResolvedValue([]) },
      entity: {
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn(),
        create: vi.fn(),
      },
      entityAlias: { createMany: vi.fn() },
      tickerEntity: { create: vi.fn(), findFirst: vi.fn() },
      entityRelation: { create: vi.fn(), findUnique: vi.fn() },
      articleEntity: { upsert: vi.fn() },
      articleRelevance: {
        upsert: vi.fn(),
        count: vi.fn().mockResolvedValue(0),
        findFirst: vi.fn().mockResolvedValue(null),
      },
      $transaction: vi.fn(),
    };

    await loadAnalysisContext(
      { tickerId: "ticker-1", unanalyzed: true },
      { db: db as never },
    );

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tickerId: "ticker-1",
          NOT: {
            articleRelevances: {
              some: { tickerId: "ticker-1" },
            },
          },
        }),
      }),
    );
    expect(db.articleRelevance.count).toHaveBeenCalled();
    expect(db.articleRelevance.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tickerId: "ticker-1" },
        orderBy: { scoredAt: "desc" },
        select: { scoredAt: true },
      }),
    );
  });

  it("loads all ticker sources when unanalyzed is false", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const db = {
      dataSource: { findMany, findUnique: vi.fn(), findFirst: vi.fn() },
      entityType: { findMany: vi.fn().mockResolvedValue([]) },
      relationType: { findMany: vi.fn().mockResolvedValue([]) },
      entity: {
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn(),
        create: vi.fn(),
      },
      entityAlias: { createMany: vi.fn() },
      tickerEntity: { create: vi.fn(), findFirst: vi.fn() },
      entityRelation: { create: vi.fn(), findUnique: vi.fn() },
      articleEntity: { upsert: vi.fn() },
      articleRelevance: {
        upsert: vi.fn(),
        count: vi.fn().mockResolvedValue(2),
        findFirst: vi.fn().mockResolvedValue(null),
      },
      $transaction: vi.fn(),
    };

    const result = await loadAnalysisContext(
      { tickerId: "ticker-2", unanalyzed: false },
      { db: db as never },
    );

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tickerId: "ticker-2" },
      }),
    );
    expect(result.dataSourceTotalCount).toBe(0);
    expect(result.relevanceSelectionState.selectedCountToday).toBe(2);
    expect(result.lastRelevanceScoredAtIso).toBeNull();
  });

  it("returns lastRelevanceScoredAtIso from the latest scored row", async () => {
    const scoredAt = new Date("2026-03-10T12:00:00.000Z");
    const db = {
      dataSource: {
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
      },
      entityType: { findMany: vi.fn().mockResolvedValue([]) },
      relationType: { findMany: vi.fn().mockResolvedValue([]) },
      entity: {
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn(),
        create: vi.fn(),
      },
      entityAlias: { createMany: vi.fn() },
      tickerEntity: { create: vi.fn(), findFirst: vi.fn() },
      entityRelation: { create: vi.fn(), findUnique: vi.fn() },
      articleEntity: { upsert: vi.fn() },
      articleRelevance: {
        upsert: vi.fn(),
        count: vi.fn().mockResolvedValue(0),
        findFirst: vi.fn().mockResolvedValue({ scoredAt }),
      },
      $transaction: vi.fn(),
    };

    const result = await loadAnalysisContext(
      { tickerId: "ticker-debounce", unanalyzed: true },
      { db: db as never },
    );

    expect(result.lastRelevanceScoredAtIso).toBe(scoredAt.toISOString());
  });

  it("applies take and returns total count when limit is set", async () => {
    const row = {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      url: "https://example.com/a",
      title: "A",
      content: "body",
      tickerId: "ticker-limit",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    };
    const findMany = vi.fn().mockResolvedValue([row]);
    const count = vi.fn().mockResolvedValue(42);
    const db = {
      dataSource: { findMany, count, findUnique: vi.fn(), findFirst: vi.fn() },
      entityType: { findMany: vi.fn().mockResolvedValue([]) },
      relationType: { findMany: vi.fn().mockResolvedValue([]) },
      entity: {
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn(),
        create: vi.fn(),
      },
      entityAlias: { createMany: vi.fn() },
      tickerEntity: { create: vi.fn(), findFirst: vi.fn() },
      entityRelation: { create: vi.fn(), findUnique: vi.fn() },
      articleEntity: { upsert: vi.fn() },
      articleRelevance: {
        upsert: vi.fn(),
        count: vi.fn().mockResolvedValue(0),
        findFirst: vi.fn().mockResolvedValue(null),
      },
      $transaction: vi.fn(),
    };

    const result = await loadAnalysisContext(
      { tickerId: "ticker-limit", unanalyzed: true, limit: 5 },
      { db: db as never },
    );

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 5,
        where: expect.objectContaining({ tickerId: "ticker-limit" }),
      }),
    );
    expect(count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tickerId: "ticker-limit" }),
      }),
    );
    expect(result.dataSources).toEqual([row]);
    expect(result.dataSourceTotalCount).toBe(42);
  });

  it("filters by createdAt gte when start is set", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const db = {
      dataSource: { findMany, findUnique: vi.fn(), findFirst: vi.fn() },
      entityType: { findMany: vi.fn().mockResolvedValue([]) },
      relationType: { findMany: vi.fn().mockResolvedValue([]) },
      entity: {
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn(),
        create: vi.fn(),
      },
      entityAlias: { createMany: vi.fn() },
      tickerEntity: { create: vi.fn(), findFirst: vi.fn() },
      entityRelation: { create: vi.fn(), findUnique: vi.fn() },
      articleEntity: { upsert: vi.fn() },
      articleRelevance: {
        upsert: vi.fn(),
        count: vi.fn().mockResolvedValue(0),
        findFirst: vi.fn().mockResolvedValue(null),
      },
      $transaction: vi.fn(),
    };

    await loadAnalysisContext(
      {
        tickerId: "ticker-w",
        unanalyzed: true,
        start: "2026-01-01T00:00:00.000Z",
      },
      { db: db as never },
    );

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: { gte: new Date("2026-01-01T00:00:00.000Z") },
        }),
      }),
    );
  });

  it("filters by createdAt lte when end is set", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const db = {
      dataSource: { findMany, findUnique: vi.fn(), findFirst: vi.fn() },
      entityType: { findMany: vi.fn().mockResolvedValue([]) },
      relationType: { findMany: vi.fn().mockResolvedValue([]) },
      entity: {
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn(),
        create: vi.fn(),
      },
      entityAlias: { createMany: vi.fn() },
      tickerEntity: { create: vi.fn(), findFirst: vi.fn() },
      entityRelation: { create: vi.fn(), findUnique: vi.fn() },
      articleEntity: { upsert: vi.fn() },
      articleRelevance: {
        upsert: vi.fn(),
        count: vi.fn().mockResolvedValue(0),
        findFirst: vi.fn().mockResolvedValue(null),
      },
      $transaction: vi.fn(),
    };

    await loadAnalysisContext(
      {
        tickerId: "ticker-w",
        unanalyzed: false,
        end: "2026-12-31T23:59:59.999Z",
      },
      { db: db as never },
    );

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: { lte: new Date("2026-12-31T23:59:59.999Z") },
        }),
      }),
    );
  });

  it("filters by createdAt gte and lte when both bounds are set", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const db = {
      dataSource: { findMany, findUnique: vi.fn(), findFirst: vi.fn() },
      entityType: { findMany: vi.fn().mockResolvedValue([]) },
      relationType: { findMany: vi.fn().mockResolvedValue([]) },
      entity: {
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn(),
        create: vi.fn(),
      },
      entityAlias: { createMany: vi.fn() },
      tickerEntity: { create: vi.fn(), findFirst: vi.fn() },
      entityRelation: { create: vi.fn(), findUnique: vi.fn() },
      articleEntity: { upsert: vi.fn() },
      articleRelevance: {
        upsert: vi.fn(),
        count: vi.fn().mockResolvedValue(0),
        findFirst: vi.fn().mockResolvedValue(null),
      },
      $transaction: vi.fn(),
    };

    await loadAnalysisContext(
      {
        tickerId: "ticker-w",
        unanalyzed: true,
        start: "2026-01-01T00:00:00.000Z",
        end: "2026-01-15T00:00:00.000Z",
      },
      { db: db as never },
    );

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: {
            gte: new Date("2026-01-01T00:00:00.000Z"),
            lte: new Date("2026-01-15T00:00:00.000Z"),
          },
        }),
      }),
    );
  });

  it("maps existing entities with alias strings", async () => {
    const db = {
      dataSource: {
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
      },
      entityType: { findMany: vi.fn().mockResolvedValue([]) },
      relationType: { findMany: vi.fn().mockResolvedValue([]) },
      entity: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "ent-1",
            canonicalName: "Acme",
            typeId: "type-1",
            aliases: [{ alias: "ACME" }, { alias: "Acme Co" }],
          },
        ]),
        findFirst: vi.fn(),
        create: vi.fn(),
      },
      entityAlias: { createMany: vi.fn() },
      tickerEntity: { create: vi.fn(), findFirst: vi.fn() },
      entityRelation: { create: vi.fn(), findUnique: vi.fn() },
      articleEntity: { upsert: vi.fn() },
      articleRelevance: {
        upsert: vi.fn(),
        count: vi.fn().mockResolvedValue(0),
        findFirst: vi.fn().mockResolvedValue(null),
      },
      $transaction: vi.fn(),
    };

    const result = await loadAnalysisContext(
      { tickerId: "ticker-3", unanalyzed: true },
      { db: db as never },
    );

    expect(result.existingEntities).toEqual([
      {
        id: "ent-1",
        canonicalName: "Acme",
        typeId: "type-1",
        aliases: ["ACME", "Acme Co"],
      },
    ]);
  });
});

describe("applyAnalysisPost", () => {
  it("throws when a dataSourceId is not scoped to the ticker", async () => {
    const DS_BAD = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const tx = {
      dataSource: {
        findUnique: vi
          .fn()
          .mockImplementation(({ where: { id } }: { where: { id: string } }) =>
            Promise.resolve(
              id === DS_BAD ? { tickerId: "other-ticker" } : null,
            ),
          ),
      },
    };

    const db = {
      dataSource: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
      },
      entityType: { findMany: vi.fn() },
      relationType: { findMany: vi.fn() },
      entity: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
      entityAlias: { createMany: vi.fn() },
      tickerEntity: { create: vi.fn(), findFirst: vi.fn() },
      entityRelation: { create: vi.fn(), findUnique: vi.fn() },
      articleEntity: { upsert: vi.fn() },
      articleRelevance: { upsert: vi.fn() },
      $transaction: vi.fn((fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
    };

    await expect(
      applyAnalysisPost(
        {
          tickerId: "ticker-1",
          entities: [],
          relations: [],
          articleEntities: [
            {
              dataSourceId: DS_BAD,
              entityName: "X",
              mentionCount: 1,
              confidence: 1,
            },
          ],
          articleRelevances: [],
        },
        { db: db as never },
      ),
    ).rejects.toThrow(AnalysisPostValidationError);
  });

  it("upserts article relevance on repeat POST with the same keys (idempotent)", async () => {
    const DS = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const tx = {
      dataSource: {
        findUnique: vi.fn().mockResolvedValue({ tickerId: "ticker-1" }),
      },
      articleRelevance: { upsert: vi.fn() },
    };
    const db = {
      dataSource: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
      },
      entityType: { findMany: vi.fn() },
      relationType: { findMany: vi.fn() },
      entity: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
      entityAlias: { createMany: vi.fn() },
      tickerEntity: { create: vi.fn(), findFirst: vi.fn() },
      entityRelation: { create: vi.fn(), findUnique: vi.fn() },
      articleEntity: { upsert: vi.fn() },
      articleRelevance: { upsert: vi.fn(), count: vi.fn() },
      $transaction: vi.fn((fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
    };

    const body = {
      tickerId: "ticker-1",
      entities: [],
      relations: [],
      articleEntities: [],
      articleRelevances: [
        {
          dataSourceId: DS,
          score: 0.5,
          scoreBreakdown: {
            breakingNews: 0.1,
            kgRelation: 0.1,
            fundamental: 0.1,
            tickerSalience: 0.1,
            sourceQuality: 0.1,
            _version: 1,
          },
          selected: false,
        },
      ],
    };

    await applyAnalysisPost(body, { db: db as never });
    await applyAnalysisPost(body, { db: db as never });

    expect(tx.articleRelevance.upsert).toHaveBeenCalledTimes(2);
    expect(tx.articleRelevance.upsert).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: {
          dataSourceId_tickerId: {
            dataSourceId: DS,
            tickerId: "ticker-1",
          },
        },
        create: expect.objectContaining({
          dataSourceId: DS,
          tickerId: "ticker-1",
        }),
        update: expect.objectContaining({
          score: 0.5,
          selected: false,
        }),
      }),
    );
    expect(tx.articleRelevance.upsert).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: {
          dataSourceId_tickerId: {
            dataSourceId: DS,
            tickerId: "ticker-1",
          },
        },
      }),
    );
  });
});
