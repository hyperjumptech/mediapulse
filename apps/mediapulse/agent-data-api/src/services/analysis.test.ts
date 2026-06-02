/** @vitest-environment node */
import {
  ANALYSIS_GET_DATA_SOURCE_LIMIT_MAX,
  getAnalysisQuerySchema,
} from "@workspace/agent-data-api-contract";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@mediapulse/database", () => ({
  prisma: {},
}));

const mockLoggerWarn = vi.fn();
vi.mock("@workspace/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: mockLoggerWarn,
    error: vi.fn(),
    child: vi.fn(() => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    })),
  },
}));

let AnalysisPostValidationError: typeof import("./analysis.js").AnalysisPostValidationError;
let applyAnalysisPost: typeof import("./analysis.js").applyAnalysisPost;
let deleteAnalysisDataSource: typeof import("./analysis.js").deleteAnalysisDataSource;
let loadAnalysisContext: typeof import("./analysis.js").loadAnalysisContext;
let normalizeAnalysisName: typeof import("./analysis.js").normalizeAnalysisName;

beforeAll(async () => {
  const mod = await import("./analysis.js");
  AnalysisPostValidationError = mod.AnalysisPostValidationError;
  applyAnalysisPost = mod.applyAnalysisPost;
  deleteAnalysisDataSource = mod.deleteAnalysisDataSource;
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
      ticker: {
        findUnique: vi.fn().mockResolvedValue({
          id: "ticker-1",
          symbol: "T1",
          name: "Ticker One",
        }),
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
      entityEvidence: { upsert: vi.fn() },
      entityRelationEvidence: { upsert: vi.fn() },
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
      ticker: {
        findUnique: vi.fn().mockResolvedValue({
          id: "ticker-2",
          symbol: "T2",
          name: "Ticker Two",
        }),
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
      entityEvidence: { upsert: vi.fn() },
      entityRelationEvidence: { upsert: vi.fn() },
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
      ticker: {
        findUnique: vi.fn().mockResolvedValue({
          id: "ticker-debounce",
          symbol: "TD",
          name: "Ticker Debounce",
        }),
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
      entityEvidence: { upsert: vi.fn() },
      entityRelationEvidence: { upsert: vi.fn() },
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
      ticker: {
        findUnique: vi.fn().mockResolvedValue({
          id: "ticker-limit",
          symbol: "TL",
          name: "Ticker Limit",
        }),
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
      entityEvidence: { upsert: vi.fn() },
      entityRelationEvidence: { upsert: vi.fn() },
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
      ticker: {
        findUnique: vi.fn().mockResolvedValue({
          id: "ticker-w",
          symbol: "TW",
          name: "Ticker Window",
        }),
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
      entityEvidence: { upsert: vi.fn() },
      entityRelationEvidence: { upsert: vi.fn() },
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
      ticker: {
        findUnique: vi.fn().mockResolvedValue({
          id: "ticker-w",
          symbol: "TW",
          name: "Ticker Window",
        }),
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
      entityEvidence: { upsert: vi.fn() },
      entityRelationEvidence: { upsert: vi.fn() },
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
      ticker: {
        findUnique: vi.fn().mockResolvedValue({
          id: "ticker-w",
          symbol: "TW",
          name: "Ticker Window",
        }),
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
      entityEvidence: { upsert: vi.fn() },
      entityRelationEvidence: { upsert: vi.fn() },
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
      ticker: {
        findUnique: vi.fn().mockResolvedValue({
          id: "ticker-3",
          symbol: "T3",
          name: "Ticker Three",
        }),
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
      entityEvidence: { upsert: vi.fn() },
      entityRelationEvidence: { upsert: vi.fn() },
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
    const db = {
      dataSource: {
        findMany: vi.fn(),
        findUnique: vi
          .fn()
          .mockImplementation(({ where: { id } }: { where: { id: string } }) =>
            Promise.resolve(
              id === DS_BAD ? { tickerId: "other-ticker" } : null,
            ),
          ),
        findFirst: vi.fn(),
      },
      ticker: { findUnique: vi.fn() },
      entityType: { findMany: vi.fn() },
      relationType: { findMany: vi.fn() },
      entity: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
      entityAlias: { createMany: vi.fn() },
      tickerEntity: { create: vi.fn(), findFirst: vi.fn() },
      entityRelation: { create: vi.fn(), findUnique: vi.fn() },
      entityEvidence: { upsert: vi.fn() },
      entityRelationEvidence: { upsert: vi.fn() },
      articleEntity: { upsert: vi.fn() },
      articleRelevance: { upsert: vi.fn() },
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
          entityEvidence: [],
          relationEvidence: [],
        },
        { db: db as never },
      ),
    ).rejects.toThrow(AnalysisPostValidationError);
  });

  it("upserts article relevance on repeat POST with the same keys (idempotent)", async () => {
    const DS = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const db = {
      dataSource: {
        findMany: vi.fn(),
        findUnique: vi.fn().mockResolvedValue({ tickerId: "ticker-1" }),
        findFirst: vi.fn(),
      },
      ticker: {
        findUnique: vi.fn().mockResolvedValue({
          symbol: "T1",
          name: "Ticker One",
          metadata: null,
        }),
      },
      entityType: {
        findMany: vi.fn(),
        findFirst: vi.fn().mockResolvedValue({ id: "company-type" }),
      },
      relationType: { findMany: vi.fn() },
      entity: {
        findMany: vi.fn(),
        findFirst: vi.fn().mockResolvedValue({ id: "issuer-entity" }),
        create: vi.fn(),
      },
      entityAlias: { createMany: vi.fn() },
      tickerEntity: { create: vi.fn(), findFirst: vi.fn() },
      entityRelation: { create: vi.fn(), findUnique: vi.fn() },
      entityEvidence: { upsert: vi.fn() },
      entityRelationEvidence: { upsert: vi.fn() },
      articleEntity: { upsert: vi.fn() },
      articleRelevance: { upsert: vi.fn(), count: vi.fn() },
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
      entityEvidence: [],
      relationEvidence: [],
    };

    await applyAnalysisPost(body, { db: db as never });
    await applyAnalysisPost(body, { db: db as never });

    expect(db.articleRelevance.upsert).toHaveBeenCalledTimes(2);
    expect(db.articleRelevance.upsert).toHaveBeenNthCalledWith(
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
    expect(db.articleRelevance.upsert).toHaveBeenNthCalledWith(
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

  it("skips article entity mention when entityName is not in ticker vocabulary", async () => {
    // Setup
    const DS = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const db = {
      dataSource: {
        findMany: vi.fn(),
        findUnique: vi.fn().mockResolvedValue({ tickerId: "ticker-1" }),
        findFirst: vi.fn(),
      },
      ticker: {
        findUnique: vi.fn().mockResolvedValue({
          symbol: "T1",
          name: "Ticker One",
          metadata: null,
        }),
      },
      entityType: {
        findMany: vi.fn(),
        findFirst: vi.fn().mockResolvedValue({ id: "company-type" }),
      },
      relationType: { findMany: vi.fn() },
      entity: {
        findMany: vi.fn(),
        findFirst: vi
          .fn()
          // First call is for issuer anchor reuse.
          .mockResolvedValueOnce({ id: "issuer-entity" })
          // Subsequent lookups (e.g. Unknown Corp) should not match.
          .mockResolvedValue(null),
        create: vi.fn(),
      },
      entityAlias: { createMany: vi.fn() },
      tickerEntity: { create: vi.fn(), findFirst: vi.fn() },
      entityRelation: { create: vi.fn(), findUnique: vi.fn() },
      entityEvidence: { upsert: vi.fn() },
      entityRelationEvidence: { upsert: vi.fn() },
      articleEntity: { upsert: vi.fn() },
      articleRelevance: { upsert: vi.fn(), count: vi.fn() },
    };

    // Act: mention references an entity name not in the vocab and not in entities list.
    const result = await applyAnalysisPost(
      {
        tickerId: "ticker-1",
        entities: [],
        relations: [],
        articleEntities: [
          {
            dataSourceId: DS,
            entityName: "Unknown Corp",
            mentionCount: 1,
            confidence: 0.9,
          },
        ],
        articleRelevances: [],
        entityEvidence: [],
        relationEvidence: [],
      },
      { db: db as never },
    );

    // Assert: resolves without throwing; articleEntity.upsert never called; warn logged.
    expect(result.entitiesCreated).toBe(0);
    expect(db.articleEntity.upsert).not.toHaveBeenCalled();
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      expect.objectContaining({
        tickerId: "ticker-1",
        entityName: "Unknown Corp",
        dataSourceId: DS,
      }),
      expect.stringContaining("entityName not in ticker vocabulary"),
    );
  });

  it("upserts entity and relation evidence for known vocabulary", async () => {
    // Setup
    const DS = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const ENT_ID = "11111111-1111-4111-a111-111111111111";
    const REL_ID = "33333333-3333-4333-a333-333333333333";
    const TYPE_ID = "44444444-4444-4444-a444-444444444444";
    const db = {
      dataSource: {
        findMany: vi.fn(),
        findUnique: vi.fn().mockResolvedValue({ tickerId: "ticker-1" }),
        findFirst: vi.fn(),
      },
      ticker: {
        findUnique: vi.fn().mockResolvedValue({
          symbol: "T1",
          name: "Ticker One",
          metadata: null,
        }),
      },
      entityType: {
        findMany: vi.fn(),
        findFirst: vi.fn().mockResolvedValue({ id: "company-type" }),
      },
      relationType: { findMany: vi.fn() },
      entity: {
        findMany: vi.fn(),
        findFirst: vi
          .fn()
          .mockImplementation(
            ({
              where,
            }: {
              where: { typeId: string; OR: Array<Record<string, unknown>> };
            }) =>
              Promise.resolve(
                where.typeId === "company-type"
                  ? { id: "issuer-entity" }
                  : null,
              ),
          ),
        create: vi.fn().mockResolvedValue({ id: ENT_ID }),
      },
      entityAlias: { createMany: vi.fn() },
      tickerEntity: { create: vi.fn(), findFirst: vi.fn() },
      entityRelation: {
        create: vi.fn().mockResolvedValue({ id: REL_ID }),
        findUnique: vi.fn().mockResolvedValue(null),
      },
      entityEvidence: { upsert: vi.fn() },
      entityRelationEvidence: { upsert: vi.fn() },
      articleEntity: { upsert: vi.fn() },
      articleRelevance: { upsert: vi.fn(), count: vi.fn() },
    };

    // Act
    const result = await applyAnalysisPost(
      {
        tickerId: "ticker-1",
        entities: [
          {
            canonicalName: "Acme Corp",
            typeId: TYPE_ID,
            aliases: [],
          },
        ],
        relations: [
          {
            fromEntityName: "Acme Corp",
            toEntityName: "Acme Corp",
            relationTypeId: "22222222-2222-4222-a222-222222222222",
          },
        ],
        articleEntities: [],
        articleRelevances: [],
        entityEvidence: [
          {
            dataSourceId: DS,
            entityName: "Acme Corp",
            confidence: 0.85,
          },
        ],
        relationEvidence: [
          {
            dataSourceId: DS,
            fromEntityName: "Acme Corp",
            toEntityName: "Acme Corp",
            relationTypeId: "22222222-2222-4222-a222-222222222222",
            evidenceSpan: "Acme announced",
          },
        ],
      },
      { db: db as never },
    );

    // Assert
    expect(result.entityEvidenceUpserted).toBe(1);
    expect(result.relationEvidenceUpserted).toBe(1);
    expect(db.entityEvidence.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          entityId_dataSourceId_tickerId: {
            entityId: ENT_ID,
            dataSourceId: DS,
            tickerId: "ticker-1",
          },
        },
        create: expect.objectContaining({
          confidence: 0.85,
        }),
      }),
    );
    expect(db.entityRelationEvidence.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          entityRelationId_dataSourceId_tickerId: {
            entityRelationId: REL_ID,
            dataSourceId: DS,
            tickerId: "ticker-1",
          },
        },
        create: expect.objectContaining({
          evidenceSpan: "Acme announced",
        }),
      }),
    );
  });
});

describe("deleteAnalysisDataSource", () => {
  it("deletes source scoped by ticker id", async () => {
    // Setup
    const db = {
      dataSource: {
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };

    // Act
    const result = await deleteAnalysisDataSource(
      {
        tickerId: "ticker-1",
        dataSourceId: "11111111-1111-4111-a111-111111111111",
      },
      { db: db as never },
    );

    // Assert
    expect(db.dataSource.deleteMany).toHaveBeenCalledWith({
      where: {
        id: "11111111-1111-4111-a111-111111111111",
        tickerId: "ticker-1",
      },
    });
    expect(result).toEqual({ deleted: true });
  });

  it("returns deleted false when no row matches", async () => {
    // Setup
    const db = {
      dataSource: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    };

    // Act
    const result = await deleteAnalysisDataSource(
      {
        tickerId: "ticker-1",
        dataSourceId: "11111111-1111-4111-a111-111111111111",
      },
      { db: db as never },
    );

    // Assert
    expect(result).toEqual({ deleted: false });
  });
});
