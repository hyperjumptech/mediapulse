/** @vitest-environment node */
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@mediapulse/database", () => ({
  prisma: {},
}));

vi.mock("./search-query-yield.js", () => ({
  getQueryYieldSummary: vi.fn().mockResolvedValue({
    perTemplate: [],
    perIntent: [],
    perPersona: [],
  }),
}));

const TICKER_ID = "11111111-1111-4111-a111-111111111111";
const PEER_ONE_ID = "22222222-2222-4222-a222-222222222222";
const PEER_TWO_ID = "33333333-3333-4333-a333-333333333333";
const ENTITY_A_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ENTITY_B_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

let getQueryAnalysisContext: typeof import("./query-analysis.js").getQueryAnalysisContext;

beforeAll(async () => {
  ({ getQueryAnalysisContext } = await import("./query-analysis.js"));
});

describe("getQueryAnalysisContext", () => {
  it("returns enriched context with peers, headlines, calendar, and KG neighborhood", async () => {
    const findUniqueOrThrow = vi.fn().mockResolvedValue({
      id: TICKER_ID,
      symbol: "ACME",
      name: "Acme Co",
      metadata: { Sektor: "Technology", Industri: "Software" },
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    const tickerEntityFindMany = vi.fn().mockResolvedValue([
      {
        entityId: ENTITY_A_ID,
        relevanceWeight: 0.9,
        entity: {
          canonicalName: "Alpha Subsidiary",
          type: { name: "Organization" },
        },
      },
      {
        entityId: ENTITY_B_ID,
        relevanceWeight: 0.7,
        entity: {
          canonicalName: "Beta Partner",
          type: { name: "Organization" },
        },
      },
    ]);
    const dataSourceFindMany = vi
      .fn()
      .mockResolvedValueOnce([
        { title: "AI momentum" },
        { title: "Cloud growth" },
        { title: "Margin watch" },
        { title: "Supply chain" },
      ])
      .mockResolvedValueOnce([
        {
          title: "Acme beats estimates",
          url: "https://www.reuters.com/markets/acme",
          createdAt: new Date("2026-05-18T10:00:00.000Z"),
          metadata: { publishedAt: "2026-05-18T08:00:00.000Z" },
        },
        {
          title: "Acme expands cloud unit",
          url: "https://news.example.com/acme-cloud",
          createdAt: new Date("2026-05-17T10:00:00.000Z"),
          metadata: null,
        },
        {
          title: "Analyst upgrade for Acme",
          url: "https://finance.example.com/acme-upgrade",
          createdAt: new Date("2026-05-16T10:00:00.000Z"),
          metadata: { eventType: "ratings_change" },
        },
        {
          title: "CFO transition at Acme",
          url: "https://finance.example.com/acme-cfo",
          createdAt: new Date("2026-05-15T10:00:00.000Z"),
          metadata: { eventType: "executive_departure" },
        },
      ])
      .mockResolvedValueOnce([
        { metadata: { eventType: "ratings_change" } },
        { metadata: { eventType: "executive_departure" } },
      ]);
    const tickerFindMany = vi.fn().mockResolvedValue([
      {
        id: PEER_ONE_ID,
        symbol: "PEER1",
        name: "Peer One",
        metadata: { Sektor: "Technology", marketCap: 500 },
      },
      {
        id: PEER_TWO_ID,
        symbol: "PEER2",
        name: "Peer Two",
        metadata: { Sektor: "Technology", marketCap: 900 },
      },
    ]);
    const entityRelationFindMany = vi.fn().mockResolvedValue([
      {
        fromEntityId: ENTITY_A_ID,
        toEntityId: ENTITY_B_ID,
        fromEntity: { canonicalName: "Alpha Subsidiary" },
        toEntity: { canonicalName: "Beta Partner" },
        relationType: { name: "PARTNER_OF" },
      },
      {
        fromEntityId: ENTITY_B_ID,
        toEntityId: ENTITY_A_ID,
        fromEntity: { canonicalName: "Beta Partner" },
        toEntity: { canonicalName: "Alpha Subsidiary" },
        relationType: { name: "COMPETITOR" },
      },
      {
        fromEntityId: ENTITY_A_ID,
        toEntityId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        fromEntity: { canonicalName: "Alpha Subsidiary" },
        toEntity: { canonicalName: "Gamma Vendor" },
        relationType: { name: "SUPPLIER_OF" },
      },
    ]);

    const db = {
      ticker: { findUniqueOrThrow, findMany: tickerFindMany },
      tickerEntity: { findMany: tickerEntityFindMany },
      dataSource: { findMany: dataSourceFindMany },
      entityRelation: { findMany: entityRelationFindMany },
      searchQuerySet: {
        updateMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        findUnique: vi.fn(),
        delete: vi.fn(),
      },
      searchQuery: { deleteMany: vi.fn(), createMany: vi.fn() },
    };

    const payload = await getQueryAnalysisContext({ tickerId: TICKER_ID }, db);

    expect(payload.peers).toEqual([
      { symbol: "PEER2", name: "Peer Two", relevance: 1 },
      { symbol: "PEER1", name: "Peer One", relevance: 0.9 },
    ]);
    expect(payload.headlineSamples).toHaveLength(4);
    expect(payload.headlineSamples[0]).toEqual({
      title: "Acme beats estimates",
      publishedAt: "2026-05-18T08:00:00.000Z",
      sourceName: "reuters.com",
    });
    expect(payload.calendar.recentEventTypes).toEqual([
      "ratings_change",
      "executive_departure",
    ]);
    expect(payload.kgNeighborhood).toEqual([
      {
        fromEntity: "Alpha Subsidiary",
        relationType: "PARTNER_OF",
        toEntity: "Beta Partner",
      },
      {
        fromEntity: "Beta Partner",
        relationType: "COMPETITOR",
        toEntity: "Alpha Subsidiary",
      },
      {
        fromEntity: "Alpha Subsidiary",
        relationType: "SUPPLIER_OF",
        toEntity: "Gamma Vendor",
      },
    ]);
    expect(payload.priorYield).toEqual({
      perTemplate: [],
      perIntent: [],
      perPersona: [],
    });
    expect(tickerFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { not: TICKER_ID },
        }),
      }),
    );
  });

  it("returns empty enriched collections for sparse fixtures", async () => {
    const db = {
      ticker: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: TICKER_ID,
          symbol: "ACME",
          name: "Acme Co",
          metadata: null,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        }),
        findMany: vi.fn(),
      },
      tickerEntity: { findMany: vi.fn().mockResolvedValue([]) },
      dataSource: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([]),
      },
      entityRelation: { findMany: vi.fn() },
      searchQuerySet: {
        updateMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        findUnique: vi.fn(),
        delete: vi.fn(),
      },
      searchQuery: { deleteMany: vi.fn(), createMany: vi.fn() },
    };

    const payload = await getQueryAnalysisContext({ tickerId: TICKER_ID }, db);

    expect(payload.peers).toEqual([]);
    expect(payload.calendar).toEqual({ recentEventTypes: [] });
    expect(payload.headlineSamples).toEqual([]);
    expect(payload.kgNeighborhood).toEqual([]);
    expect(db.ticker.findMany).not.toHaveBeenCalled();
    expect(db.entityRelation.findMany).not.toHaveBeenCalled();
  });
});
