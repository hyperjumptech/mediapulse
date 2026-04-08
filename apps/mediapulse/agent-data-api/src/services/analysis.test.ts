/** @vitest-environment node */
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
      articleRelevance: { upsert: vi.fn() },
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
      articleRelevance: { upsert: vi.fn() },
      $transaction: vi.fn(),
    };

    await loadAnalysisContext(
      { tickerId: "ticker-2", unanalyzed: false },
      { db: db as never },
    );

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tickerId: "ticker-2" },
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
      articleRelevance: { upsert: vi.fn() },
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
});
