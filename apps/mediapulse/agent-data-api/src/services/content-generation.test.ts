/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@mediapulse/database", () => ({
  prisma: {
    dataSource: {
      findMany: vi.fn(),
    },
    ticker: {
      findUniqueOrThrow: vi.fn(),
      findUnique: vi.fn(),
    },
    newsletter: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    entityType: {
      findFirst: vi.fn(),
    },
    tickerEntity: {
      findFirst: vi.fn(),
    },
    entityRelation: {
      findMany: vi.fn(),
    },
  },
}));

import {
  createNewsletter,
  getCompetitorsForTicker,
  getDataSourcesForTicker,
  getLatestNewsletter,
  getRecentNewsletterSubjects,
} from "./content-generation.js";

type MockDb = {
  dataSource: {
    findMany: ReturnType<typeof vi.fn>;
  };
  ticker: {
    findUniqueOrThrow: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
  };
  newsletter: {
    create: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
  };
  entityType: {
    findFirst: ReturnType<typeof vi.fn>;
  };
  tickerEntity: {
    findFirst: ReturnType<typeof vi.fn>;
  };
  entityRelation: {
    findMany: ReturnType<typeof vi.fn>;
  };
};

const createMockDb = (): MockDb => ({
  dataSource: {
    findMany: vi.fn(),
  },
  ticker: {
    findUniqueOrThrow: vi.fn(),
    findUnique: vi.fn().mockResolvedValue(null),
  },
  newsletter: {
    create: vi.fn(),
    findFirst: vi.fn(),
  },
  entityType: {
    findFirst: vi.fn().mockResolvedValue(null),
  },
  tickerEntity: {
    findFirst: vi.fn().mockResolvedValue(null),
  },
  entityRelation: {
    findMany: vi.fn().mockResolvedValue([]),
  },
});

type MockNewsletterDb = {
  newsletter: {
    create: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
};

const createMockNewsletterDb = (): MockNewsletterDb => ({
  newsletter: {
    create: vi.fn(),
    findFirst: vi.fn(),
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

  it("filters by classified section analyzed today in UTC and sorts by section score desc", async () => {
    // Setup
    const db = createMockDb();
    db.ticker.findUniqueOrThrow.mockResolvedValue({
      symbol: "TEST",
      name: "Test Company",
    });
    db.dataSource.findMany.mockResolvedValue([
      {
        id: "ds-low",
        url: "https://example.com/low",
        title: "Low score",
        content: "Low",
        metadata: null,
        tickerId: "ticker-1",
        searchQueryId: "sq-1",
        section: "quickHits",
        sectionScore: 0.62,
        createdAt: new Date("2026-03-19T08:00:00.000Z"),
        updatedAt: new Date("2026-03-19T08:00:00.000Z"),
      },
      {
        id: "ds-high",
        url: "https://example.com/high",
        title: "High score",
        content: "High",
        metadata: null,
        tickerId: "ticker-1",
        searchQueryId: "sq-2",
        section: "competitiveLandscape",
        sectionScore: 0.93,
        createdAt: new Date("2026-03-19T09:00:00.000Z"),
        updatedAt: new Date("2026-03-19T09:00:00.000Z"),
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
        section: { not: null },
        analyzedAt: { gte: expectedStartOfToday },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
    expect(result.dataSources).toHaveLength(2);
    expect(result.dataSources[0]?.id).toBe("ds-high");
    expect(result.dataSources[1]?.id).toBe("ds-low");
    expect(result.tickerSymbol).toBe("TEST");
    expect(result.tickerName).toBe("Test Company");
  });

  it("returns empty dataSources and ticker metadata when no selected articles exist for today", async () => {
    // Setup
    const db = createMockDb();
    db.ticker.findUniqueOrThrow.mockResolvedValue({
      symbol: "EMPTY",
      name: "Empty Corp",
    });
    db.dataSource.findMany.mockResolvedValue([]);

    // Act
    const result = await getDataSourcesForTicker("ticker-1", {
      db: db as unknown as NonNullable<GetDataSourcesDeps["db"]>,
      now: () => new Date("2026-03-19T02:00:00.000Z"),
    });

    // Assert
    expect(result.dataSources).toEqual([]);
    expect(result.tickerSymbol).toBe("EMPTY");
    expect(result.tickerName).toBe("Empty Corp");
  });
});

describe("createNewsletter", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates newsletter with all provenance fields", async () => {
    // Setup
    const db = createMockNewsletterDb();
    const createdAt = new Date("2026-04-14T00:00:00.000Z");
    const updatedAt = new Date("2026-04-14T00:00:00.000Z");
    db.newsletter.create.mockResolvedValue({
      id: "nl-1",
      tickerId: "ticker-1",
      subject: "Market Update",
      description: null,
      content: "Content body",
      model: "gpt-4o",
      agentVersion: "1.2.3",
      configVersion: "hermes-v3",
      promptHash: "abc12345",
      configSnapshotId: "snap-001",
      promptTokens: 512,
      completionTokens: 256,
      totalTokens: 768,
      createdAt,
      updatedAt,
    });

    // Act
    const result = await createNewsletter(
      {
        subject: "Market Update",
        content: "Content body",
        tickerId: "ticker-1",
        model: "gpt-4o",
        agentVersion: "1.2.3",
        configVersion: "hermes-v3",
        promptHash: "abc12345",
        configSnapshotId: "snap-001",
        promptTokens: 512,
        completionTokens: 256,
        totalTokens: 768,
      },
      db as unknown as Parameters<typeof createNewsletter>[1],
    );

    // Assert
    expect(db.newsletter.create).toHaveBeenCalledWith({
      data: {
        subject: "Market Update",
        description: null,
        content: "Content body",
        tickerId: "ticker-1",
        model: "gpt-4o",
        agentVersion: "1.2.3",
        configVersion: "hermes-v3",
        promptHash: "abc12345",
        configSnapshotId: "snap-001",
        promptTokens: 512,
        completionTokens: 256,
        totalTokens: 768,
      },
    });
    expect(result.id).toBe("nl-1");
    expect(result.model).toBe("gpt-4o");
    expect(result.promptTokens).toBe(512);
  });

  it("creates newsletter without provenance fields (backward-compatible)", async () => {
    // Setup
    const db = createMockNewsletterDb();
    const createdAt = new Date("2026-04-14T00:00:00.000Z");
    const updatedAt = new Date("2026-04-14T00:00:00.000Z");
    db.newsletter.create.mockResolvedValue({
      id: "nl-2",
      tickerId: "ticker-1",
      subject: "Simple Subject",
      description: null,
      content: "Simple content",
      model: null,
      agentVersion: null,
      configVersion: null,
      promptHash: null,
      configSnapshotId: null,
      promptTokens: null,
      completionTokens: null,
      totalTokens: null,
      createdAt,
      updatedAt,
    });

    // Act
    await createNewsletter(
      {
        subject: "Simple Subject",
        content: "Simple content",
        tickerId: "ticker-1",
      },
      db as unknown as Parameters<typeof createNewsletter>[1],
    );

    // Assert
    expect(db.newsletter.create).toHaveBeenCalledWith({
      data: {
        subject: "Simple Subject",
        description: null,
        content: "Simple content",
        tickerId: "ticker-1",
        model: null,
        agentVersion: null,
        configVersion: null,
        promptHash: null,
        configSnapshotId: null,
        promptTokens: null,
        completionTokens: null,
        totalTokens: null,
      },
    });
  });

  it("passes description as null when omitted", async () => {
    // Setup
    const db = createMockNewsletterDb();
    const createdAt = new Date("2026-04-14T00:00:00.000Z");
    const updatedAt = new Date("2026-04-14T00:00:00.000Z");
    db.newsletter.create.mockResolvedValue({
      id: "nl-3",
      tickerId: "ticker-1",
      subject: "No Desc Subject",
      description: null,
      content: "No desc content",
      model: null,
      agentVersion: null,
      configVersion: null,
      promptHash: null,
      configSnapshotId: null,
      promptTokens: null,
      completionTokens: null,
      totalTokens: null,
      createdAt,
      updatedAt,
    });

    // Act
    await createNewsletter(
      {
        subject: "No Desc Subject",
        content: "No desc content",
        tickerId: "ticker-1",
      },
      db as unknown as Parameters<typeof createNewsletter>[1],
    );

    // Assert
    expect(db.newsletter.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          description: null,
        }),
      }),
    );
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

describe("getRecentNewsletterSubjects", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns subjects and createdAt for newsletters within the lookback window", async () => {
    // Setup
    const db = createMockNewsletterDb();
    const createdAt = new Date("2026-04-20T12:00:00.000Z");
    db.newsletter.findMany.mockResolvedValue([
      { subject: "BCA profit up 12%", createdAt },
    ]);

    // Act
    const result = await getRecentNewsletterSubjects(
      "ticker-1",
      7,
      db as unknown as Parameters<typeof getRecentNewsletterSubjects>[2],
    );

    // Assert
    expect(result.items).toEqual([
      {
        subject: "BCA profit up 12%",
        createdAt: createdAt.toISOString(),
      },
    ]);
    expect(db.newsletter.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tickerId: "ticker-1",
          createdAt: expect.objectContaining({ gte: expect.any(Date) }),
        }),
        select: { subject: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      }),
    );
  });
});

type MockEntityRelationDb = {
  entityRelation: { findMany: ReturnType<typeof vi.fn> };
};

const makeCompanyEntity = (
  id: string,
  canonicalName: string,
  aliases: string[] = [],
) => ({
  id,
  canonicalName,
  type: { name: "COMPANY" },
  aliases: aliases.map((alias) => ({ alias })),
});

const makeRelation = (
  fromEntityId: string,
  toEntityId: string,
  fromEntity: ReturnType<typeof makeCompanyEntity>,
  toEntity: ReturnType<typeof makeCompanyEntity>,
  relationTypeName: string,
  weight: number,
) => ({
  fromEntityId,
  toEntityId,
  weight,
  relationType: { name: relationTypeName },
  fromEntity,
  toEntity,
});

describe("getCompetitorsForTicker — competitor resolution", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns COMPETITOR before SECTOR_PEER when ordered by weight desc", async () => {
    // Setup
    const issuerEntityId = "entity-bbca";
    const issuerEntity = makeCompanyEntity(
      issuerEntityId,
      "Bank Central Asia",
      ["BBCA"],
    );
    const mandiriEntity = makeCompanyEntity("entity-mandiri", "Bank Mandiri", [
      "Mandiri",
    ]);
    const briEntity = makeCompanyEntity("entity-bri", "Bank BRI", ["BRI"]);

    const db: MockEntityRelationDb = {
      entityRelation: {
        findMany: vi
          .fn()
          .mockResolvedValue([
            makeRelation(
              issuerEntityId,
              "entity-mandiri",
              issuerEntity,
              mandiriEntity,
              "COMPETITOR",
              0.9,
            ),
            makeRelation(
              issuerEntityId,
              "entity-bri",
              issuerEntity,
              briEntity,
              "SECTOR_PEER",
              0.6,
            ),
          ]),
      },
    };
    const issuerNormalizedAliasSet = new Set(["bank central asia", "bbca"]);

    // Act
    const result = await getCompetitorsForTicker(
      issuerEntityId,
      issuerNormalizedAliasSet,
      {},
      db as Parameters<typeof getCompetitorsForTicker>[3],
    );

    // Assert
    expect(result).toHaveLength(2);
    expect(result[0]?.name).toBe("Bank Mandiri");
    expect(result[0]?.relation).toBe("COMPETITOR");
    expect(result[0]?.weight).toBe(0.9);
    expect(result[1]?.name).toBe("Bank BRI");
    expect(result[1]?.relation).toBe("SECTOR_PEER");
    expect(result[1]?.weight).toBe(0.6);
  });

  it("filters out a self-loop edge pointing back to the issuer entityId", async () => {
    // Setup
    const issuerEntityId = "entity-bbca";
    const issuerEntity = makeCompanyEntity(
      issuerEntityId,
      "Bank Central Asia",
      ["BBCA"],
    );

    const db: MockEntityRelationDb = {
      entityRelation: {
        findMany: vi
          .fn()
          .mockResolvedValue([
            makeRelation(
              issuerEntityId,
              issuerEntityId,
              issuerEntity,
              issuerEntity,
              "COMPETITOR",
              1.0,
            ),
          ]),
      },
    };
    const issuerNormalizedAliasSet = new Set(["bank central asia", "bbca"]);

    // Act
    const result = await getCompetitorsForTicker(
      issuerEntityId,
      issuerNormalizedAliasSet,
      {},
      db as Parameters<typeof getCompetitorsForTicker>[3],
    );

    // Assert
    expect(result).toHaveLength(0);
  });

  it("filters out a peer whose normalized name matches an issuer alias", async () => {
    // Setup
    const issuerEntityId = "entity-bbca";
    const issuerEntity = makeCompanyEntity(
      issuerEntityId,
      "Bank Central Asia",
      ["BBCA"],
    );
    const aliasMatchEntity = makeCompanyEntity(
      "entity-other",
      "Bank Central Asia",
      [],
    );

    const db: MockEntityRelationDb = {
      entityRelation: {
        findMany: vi
          .fn()
          .mockResolvedValue([
            makeRelation(
              issuerEntityId,
              "entity-other",
              issuerEntity,
              aliasMatchEntity,
              "COMPETITOR",
              0.8,
            ),
          ]),
      },
    };
    const issuerNormalizedAliasSet = new Set(["bank central asia", "bbca"]);

    // Act
    const result = await getCompetitorsForTicker(
      issuerEntityId,
      issuerNormalizedAliasSet,
      {},
      db as Parameters<typeof getCompetitorsForTicker>[3],
    );

    // Assert
    expect(result).toHaveLength(0);
  });

  it("deduplicates by entityId, keeping first occurrence", async () => {
    // Setup
    const issuerEntityId = "entity-bbca";
    const issuerEntity = makeCompanyEntity(
      issuerEntityId,
      "Bank Central Asia",
      ["BBCA"],
    );
    const mandiriEntity = makeCompanyEntity(
      "entity-mandiri",
      "Bank Mandiri",
      [],
    );

    const db: MockEntityRelationDb = {
      entityRelation: {
        findMany: vi
          .fn()
          .mockResolvedValue([
            makeRelation(
              issuerEntityId,
              "entity-mandiri",
              issuerEntity,
              mandiriEntity,
              "COMPETITOR",
              0.9,
            ),
            makeRelation(
              issuerEntityId,
              "entity-mandiri",
              issuerEntity,
              mandiriEntity,
              "SECTOR_PEER",
              0.5,
            ),
          ]),
      },
    };
    const issuerNormalizedAliasSet = new Set(["bank central asia", "bbca"]);

    // Act
    const result = await getCompetitorsForTicker(
      issuerEntityId,
      issuerNormalizedAliasSet,
      {},
      db as Parameters<typeof getCompetitorsForTicker>[3],
    );

    // Assert
    expect(result).toHaveLength(1);
    expect(result[0]?.relation).toBe("COMPETITOR");
  });

  it("respects maxCompetitors cap", async () => {
    // Setup
    const issuerEntityId = "entity-issuer";
    const issuerEntity = makeCompanyEntity(issuerEntityId, "Issuer Corp", []);
    const peerRelations = Array.from({ length: 10 }, (_, index) => {
      const peerEntity = makeCompanyEntity(
        `entity-peer-${index}`,
        `Peer ${index}`,
        [],
      );
      return makeRelation(
        issuerEntityId,
        `entity-peer-${index}`,
        issuerEntity,
        peerEntity,
        "SECTOR_PEER",
        0.5,
      );
    });

    const db: MockEntityRelationDb = {
      entityRelation: { findMany: vi.fn().mockResolvedValue(peerRelations) },
    };

    // Act
    const result = await getCompetitorsForTicker(
      issuerEntityId,
      new Set(["issuer corp"]),
      { maxCompetitors: 3 },
      db as Parameters<typeof getCompetitorsForTicker>[3],
    );

    // Assert
    expect(result).toHaveLength(3);
  });

  it("returns empty array when entityRelation.findMany returns no edges", async () => {
    // Setup
    const db: MockEntityRelationDb = {
      entityRelation: { findMany: vi.fn().mockResolvedValue([]) },
    };

    // Act
    const result = await getCompetitorsForTicker(
      "entity-issuer",
      new Set(["issuer corp"]),
      {},
      db as Parameters<typeof getCompetitorsForTicker>[3],
    );

    // Assert
    expect(result).toHaveLength(0);
  });
});

describe("getDataSourcesForTicker — competitors and issuerAliases in response", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns competitors and issuerAliases when anchor and edges exist", async () => {
    // Setup
    const db = createMockDb();
    db.ticker.findUniqueOrThrow.mockResolvedValue({
      symbol: "BBCA",
      name: "Bank Central Asia",
    });
    db.ticker.findUnique.mockResolvedValue({
      symbol: "BBCA",
      name: "Bank Central Asia",
    });
    db.dataSource.findMany.mockResolvedValue([]);
    db.entityType.findFirst.mockResolvedValue({ id: "type-company" });
    db.tickerEntity.findFirst.mockResolvedValue({
      entityId: "entity-bbca",
      entity: {
        canonicalName: "Bank Central Asia",
        aliases: [{ alias: "BBCA" }, { alias: "PT Bank Central Asia Tbk" }],
      },
    });
    db.entityRelation.findMany.mockResolvedValue([
      makeRelation(
        "entity-bbca",
        "entity-mandiri",
        makeCompanyEntity("entity-bbca", "Bank Central Asia", ["BBCA"]),
        makeCompanyEntity("entity-mandiri", "Bank Mandiri", ["Mandiri"]),
        "COMPETITOR",
        0.9,
      ),
    ]);

    // Act
    const result = await getDataSourcesForTicker("ticker-bbca", {
      db: db as unknown as NonNullable<GetDataSourcesDeps["db"]>,
      now: () => new Date("2026-05-01T10:00:00.000Z"),
    });

    // Assert
    expect(result.competitors).toHaveLength(1);
    expect(result.competitors[0]?.name).toBe("Bank Mandiri");
    expect(result.competitors[0]?.relation).toBe("COMPETITOR");
    expect(result.issuerAliases).toContain("BBCA");
    expect(result.issuerAliases).toContain("Bank Central Asia");
    expect(result.issuerAliases).toContain("PT Bank Central Asia Tbk");
  });

  it("returns empty competitors and fallback issuerAliases when no KG anchor exists", async () => {
    // Setup
    const db = createMockDb();
    db.ticker.findUniqueOrThrow.mockResolvedValue({
      symbol: "NEW",
      name: "New Company",
    });
    // ticker.findUnique returns null by default in createMockDb — anchor lookup short-circuits
    db.dataSource.findMany.mockResolvedValue([]);

    // Act
    const result = await getDataSourcesForTicker("ticker-new", {
      db: db as unknown as NonNullable<GetDataSourcesDeps["db"]>,
      now: () => new Date("2026-05-01T10:00:00.000Z"),
    });

    // Assert
    expect(result.competitors).toEqual([]);
    expect(result.issuerAliases).toEqual(["NEW", "New Company"]);
    expect(result.dataSources).toEqual([]);
    expect(result.tickerSymbol).toBe("NEW");
    expect(result.tickerName).toBe("New Company");
  });

  it("returns empty competitors when anchor exists but no peer edges", async () => {
    // Setup
    const db = createMockDb();
    db.ticker.findUniqueOrThrow.mockResolvedValue({
      symbol: "SOLO",
      name: "Solo Corp",
    });
    db.ticker.findUnique.mockResolvedValue({
      symbol: "SOLO",
      name: "Solo Corp",
    });
    db.dataSource.findMany.mockResolvedValue([]);
    db.entityType.findFirst.mockResolvedValue({ id: "type-company" });
    db.tickerEntity.findFirst.mockResolvedValue({
      entityId: "entity-solo",
      entity: { canonicalName: "Solo Corp", aliases: [] },
    });
    // entityRelation.findMany returns [] by default in createMockDb

    // Act
    const result = await getDataSourcesForTicker("ticker-solo", {
      db: db as unknown as NonNullable<GetDataSourcesDeps["db"]>,
      now: () => new Date("2026-05-01T10:00:00.000Z"),
    });

    // Assert
    expect(result.competitors).toEqual([]);
    expect(result.issuerAliases).toContain("SOLO");
    expect(result.issuerAliases).toContain("Solo Corp");
  });
});
