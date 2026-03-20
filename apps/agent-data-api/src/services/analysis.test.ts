/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@workspace/database", () => ({
  prisma: {},
}));

const getService = () => import("./analysis.js");

const tickerId = "11111111-1111-4111-a111-111111111111";
const relationTypeId = "22222222-2222-4222-a222-222222222222";
const companyTypeId = "33333333-3333-4333-a333-333333333333";
const topicTypeId = "44444444-4444-4444-a444-444444444444";

const createGetDb = () => ({
  dataSource: {
    findMany: vi.fn(),
  },
  entityType: {
    findMany: vi.fn(),
  },
  relationType: {
    findMany: vi.fn(),
  },
  tickerEntity: {
    findMany: vi.fn(),
  },
});

const createTransactionalDb = (options?: {
  initialAliases?: Array<{ normalizedAlias: string; entityId: string }>;
  existingRelationKeys?: string[];
}) => {
  const aliasRows = [...(options?.initialAliases ?? [])];
  const relationKeys = new Set(options?.existingRelationKeys ?? []);
  let createCounter = 0;

  const tx = {
    dataSource: { findMany: vi.fn() },
    entityType: { findMany: vi.fn() },
    relationType: { findMany: vi.fn() },
    tickerEntity: {
      findMany: vi.fn(),
      upsert: vi.fn().mockResolvedValue(undefined),
    },
    entityAlias: {
      findMany: vi.fn().mockImplementation(async (args: any) => {
        const normalizedAliases: string[] = args.where.normalizedAlias
          .in as string[];
        const match = aliasRows.find((row) =>
          normalizedAliases.includes(row.normalizedAlias),
        );
        return match ? [{ entityId: match.entityId }] : [];
      }),
      findFirst: vi.fn().mockImplementation(async (args: any) => {
        const normalizedAlias: string = args.where.normalizedAlias;
        const match = aliasRows.find(
          (row) => row.normalizedAlias === normalizedAlias,
        );
        return match ? { entityId: match.entityId } : null;
      }),
      createMany: vi.fn().mockImplementation(async (args: any) => {
        const data = args.data as Array<{
          entityId: string;
          normalizedAlias: string;
        }>;
        for (const row of data) {
          const exists = aliasRows.some(
            (alias) =>
              alias.normalizedAlias === row.normalizedAlias &&
              alias.entityId === row.entityId,
          );
          if (!exists) {
            aliasRows.push({
              normalizedAlias: row.normalizedAlias,
              entityId: row.entityId,
            });
          }
        }
        return { count: data.length };
      }),
    },
    entity: {
      create: vi.fn().mockImplementation(async () => {
        createCounter += 1;
        return { id: `ent-new-${createCounter}` };
      }),
    },
    entityRelation: {
      findUnique: vi.fn().mockImplementation(async (args: any) => {
        const key = JSON.stringify(
          args.where.fromEntityId_toEntityId_relationTypeId,
        );
        return relationKeys.has(key) ? { id: "rel-existing" } : null;
      }),
      upsert: vi.fn().mockImplementation(async (args: any) => {
        const key = JSON.stringify(
          args.where.fromEntityId_toEntityId_relationTypeId,
        );
        relationKeys.add(key);
        return {};
      }),
    },
    articleEntity: {
      upsert: vi.fn().mockResolvedValue(undefined),
    },
    articleRelevance: {
      createMany: vi.fn().mockImplementation(async (args: any) => ({
        count: (args.data as unknown[]).length,
      })),
    },
  };

  return {
    db: {
      ...tx,
      $transaction: vi.fn(async (fn: (value: typeof tx) => Promise<unknown>) =>
        fn(tx),
      ),
    },
    tx,
  };
};

describe("analysis service", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("normalizes aliases by lowercasing, trimming, and stripping punctuation", async () => {
    // Act
    const service = await getService();
    const result = service.normalizeAlias("  PT. Golden-Energy, Mines!!  ");

    // Assert
    expect(result).toBe("pt goldenenergy mines");
  });

  it("fetches unanalyzed analysis context with vocabularies and existing aliases", async () => {
    // Setup
    const db = createGetDb();
    db.dataSource.findMany.mockResolvedValue([
      {
        id: "55555555-5555-4555-a555-555555555555",
        url: "https://example.com/a",
        title: "A",
        content: "Body",
        tickerId,
        createdAt: new Date("2026-03-19T00:00:00.000Z"),
      },
    ]);
    db.entityType.findMany.mockResolvedValue([
      { id: companyTypeId, name: "COMPANY", description: "Company" },
    ]);
    db.relationType.findMany.mockResolvedValue([
      { id: relationTypeId, name: "SUBSIDIARY_OF", description: "Relation" },
    ]);
    db.tickerEntity.findMany.mockResolvedValue([
      {
        entity: {
          id: "ent-1",
          canonicalName: "Golden Energy Mines",
          typeId: companyTypeId,
          aliases: [{ alias: "GEMS" }],
        },
      },
    ]);

    // Act
    const service = await getService();
    const result = await service.getAnalysisData(tickerId, true, db as any);

    // Assert
    expect(result.dataSources).toHaveLength(1);
    expect(result.entityTypes).toHaveLength(1);
    expect(result.relationTypes).toHaveLength(1);
    expect(result.entityTypes[0]?.name).toBe("COMPANY");
    expect(result.relationTypes[0]?.name).toBe("SUBSIDIARY_OF");
    expect(result.existingEntities).toEqual([
      {
        id: "ent-1",
        canonicalName: "Golden Energy Mines",
        typeId: companyTypeId,
        aliases: ["GEMS"],
      },
    ]);
    expect(db.dataSource.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tickerId,
          articleRelevances: { none: { tickerId } },
        }),
      }),
    );
  });

  it("omits unanalyzed filter when flag is false", async () => {
    // Setup
    const db = createGetDb();
    db.dataSource.findMany.mockResolvedValue([]);
    db.entityType.findMany.mockResolvedValue([]);
    db.relationType.findMany.mockResolvedValue([]);
    db.tickerEntity.findMany.mockResolvedValue([]);

    // Act
    const service = await getService();
    await service.getAnalysisData(tickerId, false, db as any);

    // Assert
    expect(db.dataSource.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tickerId },
      }),
    );
  });

  it("saves analysis payload with create/reuse, upserts, and relevance scores", async () => {
    // Setup
    const { db, tx } = createTransactionalDb({
      initialAliases: [{ normalizedAlias: "gems", entityId: "ent-existing" }],
    });

    // Act
    const service = await getService();
    const result = await service.saveAnalysisData(
      {
        tickerId,
        entities: [
          {
            canonicalName: "Golden Energy Mines",
            typeId: companyTypeId,
            description: "Existing entity",
            aliases: ["GEMS", "GEMS!!!"],
          },
          {
            canonicalName: "Domestic Market Obligation",
            typeId: topicTypeId,
            description: "New topic",
            aliases: ["DMO"],
          },
        ],
        relations: [
          {
            fromEntityName: "Golden Energy Mines",
            toEntityName: "Domestic Market Obligation",
            relationTypeId,
          },
          {
            fromEntityName: "GEMS",
            toEntityName: "DMO",
            relationTypeId,
          },
        ],
        articleEntities: [
          {
            dataSourceId: "66666666-6666-4666-a666-666666666666",
            entityName: "DMO",
            mentionCount: 3,
            confidence: 0.91,
            sentiment: "NEUTRAL",
          },
        ],
        articleRelevances: [
          {
            dataSourceId: "66666666-6666-4666-a666-666666666666",
            score: 0.88,
            scoreBreakdown: { overlap: 0.88 },
            selected: true,
          },
          {
            dataSourceId: "77777777-7777-4777-a777-777777777777",
            score: 0.44,
            scoreBreakdown: { overlap: 0.44 },
            selected: false,
          },
        ],
      },
      db as any,
    );

    // Assert
    expect(result).toEqual({
      entitiesCreated: 1,
      entitiesReused: 1,
      relationsCreated: 1,
      articlesScored: 2,
      articlesSelected: 1,
    });
    expect(tx.entity.create).toHaveBeenCalledTimes(1);
    expect(tx.tickerEntity.upsert).toHaveBeenCalledTimes(2);
    expect(tx.entityAlias.createMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: [
          {
            entityId: "ent-existing",
            alias: "Golden Energy Mines",
            normalizedAlias: "golden energy mines",
          },
          {
            entityId: "ent-existing",
            alias: "GEMS",
            normalizedAlias: "gems",
          },
        ],
      }),
    );
    expect(tx.articleEntity.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          dataSourceId_entityId: {
            dataSourceId: "66666666-6666-4666-a666-666666666666",
            entityId: "ent-new-1",
          },
        },
      }),
    );
    expect(tx.articleRelevance.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            dataSourceId: "66666666-6666-4666-a666-666666666666",
            tickerId,
            selected: true,
          }),
          expect.objectContaining({
            dataSourceId: "77777777-7777-4777-a777-777777777777",
            tickerId,
            selected: false,
          }),
        ],
        skipDuplicates: true,
      }),
    );
  });

  it("throws when relation references an unknown entity alias", async () => {
    // Setup
    const { db } = createTransactionalDb();

    const service = await getService();

    // Act & Assert
    await expect(
      service.saveAnalysisData(
        {
          tickerId,
          entities: [],
          relations: [
            {
              fromEntityName: "Unknown A",
              toEntityName: "Unknown B",
              relationTypeId,
            },
          ],
          articleEntities: [],
          articleRelevances: [],
        },
        db as any,
      ),
    ).rejects.toThrow('Entity alias not found for "Unknown A"');
  });
});
