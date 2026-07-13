/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";

vi.mock("@mediapulse/database", () => ({
  prisma: {},
  Prisma: { DbNull: "__DbNull__" },
}));

import { Prisma } from "@mediapulse/database";

import {
  AnalysisPostValidationError,
  applyAnalysisPost,
  deleteAnalysisDataSource,
  loadAnalysisContext,
} from "./analysis.js";

const TICKER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SEARCH_ARTICLE = "11111111-1111-4111-8111-111111111111";
const CURATED_MATCH = "22222222-2222-4222-8222-222222222222";
const CURATED_MISS = "33333333-3333-4333-8333-333333333333";

describe("loadAnalysisContext — ticker-scoped baseline", () => {
  it("counts a ticker's unanalyzed articles and maps issuer context", async () => {
    const rows = [
      {
        id: SEARCH_ARTICLE,
        url: "https://example.com/a",
        title: "A",
        description: "snippet",
        content: null,
        createdAt: new Date("2026-01-01T00:00:00Z"),
        tickerId: TICKER_ID,
        ticker: {
          symbol: "AGRO",
          name: "PT Bank Raya Indonesia Tbk",
          sector: "Keuangan",
          industry: "Bank",
          subSector: null,
          subIndustry: "Bank",
          businessActivity: "Perbankan",
        },
      },
    ];
    const findMany = vi.fn().mockResolvedValue(rows);
    const count = vi.fn().mockResolvedValue(7);

    const result = await loadAnalysisContext(
      { unanalyzed: true, limit: 5, tickerId: TICKER_ID },
      { db: { dataSource: { findMany, count } } as never },
    );

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tickerId: TICKER_ID, analyzedAt: null },
        orderBy: { createdAt: "asc" },
        take: 5,
      }),
    );
    expect(result.dataSourceTotalCount).toBe(7);
    expect(result.dataSources).toEqual([
      {
        id: SEARCH_ARTICLE,
        tickerId: TICKER_ID,
        url: "https://example.com/a",
        title: "A",
        description: "snippet",
        content: null,
        createdAt: new Date("2026-01-01T00:00:00Z"),
        ticker: {
          symbol: "AGRO",
          name: "PT Bank Raya Indonesia Tbk",
          sector: "Keuangan",
          industry: "Bank",
          subIndustry: "Bank",
          businessActivity: "Perbankan",
        },
      },
    ]);
  });
});

describe("loadAnalysisContext — candidate pairs (ticker-agnostic)", () => {
  const buildDb = (articles: unknown[]) => {
    const searchQuerySet = {
      findMany: vi.fn().mockResolvedValue([{ tickerId: TICKER_ID }]),
    };
    const ticker = {
      findMany: vi.fn().mockResolvedValue([
        {
          id: TICKER_ID,
          symbol: "BBCA",
          name: "Bank Central Asia",
          sector: null,
          industry: null,
          subSector: null,
          subIndustry: null,
          businessActivity: null,
        },
      ]),
      findUnique: vi
        .fn()
        .mockResolvedValue({ symbol: "BBCA", name: "Bank Central Asia" }),
    };
    // No seeded COMPANY entity -> issuer anchor falls back to symbol/name aliases.
    const entityType = { findFirst: vi.fn().mockResolvedValue(null) };
    const tickerEntity = { findFirst: vi.fn() };
    const entityRelation = { findMany: vi.fn().mockResolvedValue([]) };
    const dataSource = {
      findMany: vi.fn().mockResolvedValue(articles),
      count: vi.fn(),
    };

    return {
      dataSource,
      searchQuerySet,
      ticker,
      entityType,
      tickerEntity,
      entityRelation,
    };
  };

  it("pairs a search-query article with its own ticker and fans curated matches out by alias", async () => {
    const db = buildDb([
      {
        id: SEARCH_ARTICLE,
        url: "https://example.com/s",
        title: "Search hit",
        content: "anything",
        createdAt: new Date("2026-01-03T00:00:00Z"),
        tickerId: TICKER_ID,
        ticker: {
          symbol: "BBCA",
          name: "Bank Central Asia",
          sector: null,
          industry: null,
          subSector: null,
          subIndustry: null,
          businessActivity: null,
        },
        tickerSections: [],
      },
      {
        id: CURATED_MATCH,
        url: "https://example.com/c",
        title: "Bank Central Asia posts record profit",
        content: "the issuer did well",
        createdAt: new Date("2026-01-02T00:00:00Z"),
        tickerId: null,
        ticker: null,
        tickerSections: [],
      },
      {
        id: CURATED_MISS,
        url: "https://example.com/d",
        title: "Unrelated commodity news",
        content: "no issuer mention here",
        createdAt: new Date("2026-01-01T00:00:00Z"),
        tickerId: null,
        ticker: null,
        tickerSections: [],
      },
    ]);

    const result = await loadAnalysisContext(
      { unanalyzed: true, limit: 10 },
      { db: db as never },
    );

    expect(db.dataSource.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { collectionGateStatus: "passed", tickerId: null },
            { tickerId: { not: null } },
          ],
          createdAt: { gte: expect.any(Date) },
        }),
      }),
    );
    expect(result.dataSourceTotalCount).toBe(2);
    expect(result.dataSources.map((pair) => pair.id)).toEqual([
      SEARCH_ARTICLE,
      CURATED_MATCH,
    ]);
    for (const pair of result.dataSources) {
      expect(pair.tickerId).toBe(TICKER_ID);
      expect(pair.ticker.symbol).toBe("BBCA");
    }
  });

  it("gates a curated article on its description when content is null", async () => {
    const db = buildDb([
      {
        id: CURATED_MATCH,
        url: "https://example.com/c",
        title: "Unrelated headline",
        description: "Bank Central Asia posts record profit",
        content: null,
        createdAt: new Date("2026-01-02T00:00:00Z"),
        tickerId: null,
        ticker: null,
        tickerSections: [],
      },
      {
        id: CURATED_MISS,
        url: "https://example.com/d",
        title: "Unrelated headline",
        description: "no issuer mention here",
        content: null,
        createdAt: new Date("2026-01-01T00:00:00Z"),
        tickerId: null,
        ticker: null,
        tickerSections: [],
      },
    ]);

    const result = await loadAnalysisContext(
      { unanalyzed: true, limit: 10 },
      { db: db as never },
    );

    expect(result.dataSources.map((pair) => pair.id)).toEqual([CURATED_MATCH]);
    expect(result.dataSources[0]!.description).toBe(
      "Bank Central Asia posts record profit",
    );
    expect(result.dataSources[0]!.content).toBeNull();
  });

  it("skips a pair that is already classified for the ticker", async () => {
    const db = buildDb([
      {
        id: CURATED_MATCH,
        url: "https://example.com/c",
        title: "Bank Central Asia posts record profit",
        content: "the issuer did well",
        createdAt: new Date("2026-01-02T00:00:00Z"),
        tickerId: null,
        ticker: null,
        tickerSections: [{ tickerId: TICKER_ID }],
      },
    ]);

    const result = await loadAnalysisContext(
      { unanalyzed: true, limit: 10 },
      { db: db as never },
    );

    expect(result.dataSources).toEqual([]);
    expect(result.dataSourceTotalCount).toBe(0);
  });
});

describe("applyAnalysisPost", () => {
  const buildDb = () => {
    const upsert = vi.fn((args) => ({ __upsert: args }));
    const updateMany = vi.fn((args) => ({ __updateMany: args }));
    const findMany = vi.fn();
    const $transaction = vi.fn((writes: unknown[]) => Promise.resolve(writes));
    return {
      db: {
        dataSource: { findMany, updateMany },
        dataSourceTickerSection: { upsert },
        $transaction,
      },
      upsert,
      updateMany,
      findMany,
      $transaction,
    };
  };

  it("upserts per-(article, ticker) sections, marks analyzed, and returns counts", async () => {
    const { db, upsert, updateMany, findMany } = buildDb();
    findMany.mockResolvedValue([{ id: SEARCH_ARTICLE }, { id: CURATED_MATCH }]);

    const result = await applyAnalysisPost(
      {
        articleSections: [
          {
            dataSourceId: SEARCH_ARTICLE,
            tickerId: TICKER_ID,
            section: "dealsAndMovements",
            score: 0.9,
            reason: "deal",
          },
          {
            dataSourceId: CURATED_MATCH,
            tickerId: TICKER_ID,
            section: null,
            score: 0.1,
            reason: "no fit",
          },
        ],
        analyzedDataSourceIds: [SEARCH_ARTICLE, CURATED_MATCH],
      },
      { db: db as never },
    );

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          dataSourceId_tickerId: {
            dataSourceId: SEARCH_ARTICLE,
            tickerId: TICKER_ID,
          },
        },
        create: expect.objectContaining({
          dataSourceId: SEARCH_ARTICLE,
          tickerId: TICKER_ID,
          section: "dealsAndMovements",
          sectionScore: 0.9,
        }),
      }),
    );
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: { in: [SEARCH_ARTICLE, CURATED_MATCH] } },
      data: { analyzedAt: expect.any(Date) },
    });
    expect(result).toEqual({ articlesScored: 2, articlesRejected: 1 });
  });

  it("persists the score breakdown on create and update when provided", async () => {
    const { db, upsert, findMany } = buildDb();
    findMany.mockResolvedValue([{ id: SEARCH_ARTICLE }]);
    const scoreBreakdown = {
      section: "dealsAndMovements" as const,
      matched: 3,
      total: 5,
      criteriaHash: "abc123",
      criteria: [
        {
          id: "dm-corporate-action",
          section: "dealsAndMovements" as const,
          text: "Include if M&A.",
          matched: true,
          note: "acquisition announced",
        },
      ],
      sections: [
        { section: "dealsAndMovements" as const, matched: 3, total: 5 },
      ],
    };

    await applyAnalysisPost(
      {
        articleSections: [
          {
            dataSourceId: SEARCH_ARTICLE,
            tickerId: TICKER_ID,
            section: "dealsAndMovements",
            score: 0.6,
            reason: "deal",
            scoreBreakdown,
          },
        ],
        analyzedDataSourceIds: [SEARCH_ARTICLE],
      },
      { db: db as never },
    );

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          sectionScoreBreakdown: scoreBreakdown,
        }),
        update: expect.objectContaining({
          sectionScoreBreakdown: scoreBreakdown,
        }),
      }),
    );
  });

  it("writes SQL NULL for the breakdown when the poster omits it", async () => {
    const { db, upsert, findMany } = buildDb();
    findMany.mockResolvedValue([{ id: SEARCH_ARTICLE }]);

    await applyAnalysisPost(
      {
        articleSections: [
          {
            dataSourceId: SEARCH_ARTICLE,
            tickerId: TICKER_ID,
            section: "quickHits",
            score: 0.4,
            reason: "x",
          },
        ],
        analyzedDataSourceIds: [SEARCH_ARTICLE],
      },
      { db: db as never },
    );

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          sectionScoreBreakdown: Prisma.DbNull,
        }),
      }),
    );
  });

  it("commits section upserts in bounded chunks to stay under the transaction timeout", async () => {
    const { db, upsert, $transaction, findMany } = buildDb();
    const ids = Array.from(
      { length: 45 },
      (_, index) =>
        `00000000-0000-4000-a000-${String(index).padStart(12, "0")}`,
    );
    findMany.mockResolvedValue(ids.map((id) => ({ id })));

    await applyAnalysisPost(
      {
        articleSections: ids.map((id) => ({
          dataSourceId: id,
          tickerId: TICKER_ID,
          section: "quickHits" as const,
          score: 0.5,
          reason: "x",
        })),
        analyzedDataSourceIds: ids,
      },
      { db: db as never },
    );

    // 45 upserts at chunk size 20 → 3 transactions (20 + 20 + 5).
    expect(upsert).toHaveBeenCalledTimes(45);
    expect($transaction).toHaveBeenCalledTimes(3);
    expect(($transaction.mock.calls[0]?.[0] as unknown[]).length).toBe(20);
    expect(($transaction.mock.calls[2]?.[0] as unknown[]).length).toBe(5);
  });

  it("throws when a referenced data source is unknown", async () => {
    const { db, findMany } = buildDb();
    findMany.mockResolvedValue([]);

    await expect(
      applyAnalysisPost(
        {
          articleSections: [
            {
              dataSourceId: SEARCH_ARTICLE,
              tickerId: TICKER_ID,
              section: "quickHits",
              score: 0.5,
              reason: "x",
            },
          ],
          analyzedDataSourceIds: [SEARCH_ARTICLE],
        },
        { db: db as never },
      ),
    ).rejects.toBeInstanceOf(AnalysisPostValidationError);
  });
});

describe("deleteAnalysisDataSource", () => {
  it("reports deleted when a row was removed", async () => {
    const deleteMany = vi.fn().mockResolvedValue({ count: 1 });

    const result = await deleteAnalysisDataSource(
      { dataSourceId: SEARCH_ARTICLE, tickerId: "t1" },
      { db: { dataSource: { deleteMany } } as never },
    );

    expect(result).toEqual({ deleted: true });
  });
});
