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
const SECOND_TICKER_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
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
  const buildDb = (
    articles: unknown[],
    acceptedCounts: Record<string, number> = {},
  ) => {
    const searchQuerySet = {
      findMany: vi.fn().mockResolvedValue([{ tickerId: TICKER_ID }]),
    };
    const dataSourceTickerSection = {
      count: vi.fn(
        (args: { where: { tickerId: string } }) =>
          acceptedCounts[args.where.tickerId] ?? 0,
      ),
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
      dataSourceTickerSection,
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

  it("excludes a search-query article whose ticker is at cap and keeps it under cap", async () => {
    const searchArticle = {
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
    };

    const cappedDb = buildDb([searchArticle], { [TICKER_ID]: 50 });
    const cappedResult = await loadAnalysisContext(
      { unanalyzed: true, limit: 10 },
      { db: cappedDb as never },
    );

    expect(cappedResult.dataSources).toEqual([]);
    expect(cappedDb.dataSourceTickerSection.count).toHaveBeenCalledWith({
      where: { tickerId: TICKER_ID, section: { not: null } },
    });

    const underDb = buildDb([searchArticle], { [TICKER_ID]: 49 });
    const underResult = await loadAnalysisContext(
      { unanalyzed: true, limit: 10 },
      { db: underDb as never },
    );

    expect(underResult.dataSources.map((pair) => pair.id)).toEqual([
      SEARCH_ARTICLE,
    ]);
  });

  it("fans a curated article out to under-cap tickers but skips capped ones", async () => {
    const searchQuerySet = {
      findMany: vi
        .fn()
        .mockResolvedValue([
          { tickerId: TICKER_ID },
          { tickerId: SECOND_TICKER_ID },
        ]),
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
        {
          id: SECOND_TICKER_ID,
          symbol: "BBRI",
          name: "Bank Rakyat Indonesia",
          sector: null,
          industry: null,
          subSector: null,
          subIndustry: null,
          businessActivity: null,
        },
      ]),
      findUnique: vi.fn(),
    };
    const entityType = { findFirst: vi.fn().mockResolvedValue(null) };
    const tickerEntity = { findFirst: vi.fn() };
    const entityRelation = { findMany: vi.fn().mockResolvedValue([]) };
    const dataSourceTickerSection = {
      count: vi.fn((args: { where: { tickerId: string } }) =>
        args.where.tickerId === TICKER_ID ? 50 : 0,
      ),
    };
    const dataSource = {
      findMany: vi.fn().mockResolvedValue([
        {
          id: CURATED_MATCH,
          url: "https://example.com/c",
          title: "Bank Central Asia and Bank Rakyat Indonesia rally",
          content: "both issuers gained",
          createdAt: new Date("2026-01-02T00:00:00Z"),
          tickerId: null,
          ticker: null,
          tickerSections: [],
        },
      ]),
      count: vi.fn(),
    };

    const db = {
      dataSource,
      dataSourceTickerSection,
      searchQuerySet,
      ticker,
      entityType,
      tickerEntity,
      entityRelation,
    };

    const result = await loadAnalysisContext(
      { unanalyzed: true, limit: 10 },
      { db: db as never },
    );

    expect(result.dataSources.map((pair) => pair.tickerId)).toEqual([
      SECOND_TICKER_ID,
    ]);
  });
});

describe("applyAnalysisPost", () => {
  const buildDb = (acceptedCounts: Record<string, number> = {}) => {
    const upsert = vi.fn((args) => ({ __upsert: args }));
    const updateMany = vi.fn((args) => ({ __updateMany: args }));
    const findMany = vi.fn();
    const deleteMany = vi.fn().mockResolvedValue({ count: 0 });
    const count = vi.fn(
      (args: { where: { tickerId: string } }) =>
        acceptedCounts[args.where.tickerId] ?? 0,
    );
    const $transaction = vi.fn((writes: unknown[]) => Promise.resolve(writes));
    return {
      db: {
        dataSource: { findMany, updateMany, deleteMany },
        dataSourceTickerSection: { upsert, count },
        $transaction,
      },
      upsert,
      updateMany,
      findMany,
      deleteMany,
      count,
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
    expect(result).toEqual({
      articlesScored: 2,
      articlesRejected: 1,
      skippedByCap: 0,
      cappedTickerCount: 0,
    });
  });

  it("stamps the article-analysis run id on each section row", async () => {
    const { db, upsert, findMany } = buildDb();
    findMany.mockResolvedValue([{ id: SEARCH_ARTICLE }]);
    const runId = "99999999-9999-4999-8999-999999999999";

    await applyAnalysisPost(
      {
        articleSections: [
          {
            dataSourceId: SEARCH_ARTICLE,
            tickerId: TICKER_ID,
            section: "dealsAndMovements",
            score: 0.9,
            reason: "deal",
          },
        ],
        analyzedDataSourceIds: [SEARCH_ARTICLE],
        articleAnalysisRunId: runId,
      },
      { db: db as never },
    );

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ articleAnalysisRunId: runId }),
        update: expect.objectContaining({ articleAnalysisRunId: runId }),
      }),
    );
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

  it("clears leftover own sources for a ticker pushed to the cap", async () => {
    const { db, deleteMany, findMany } = buildDb({ [TICKER_ID]: 50 });
    deleteMany.mockResolvedValue({ count: 4 });
    findMany.mockResolvedValue([{ id: SEARCH_ARTICLE }]);

    const result = await applyAnalysisPost(
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
    );

    expect(deleteMany).toHaveBeenCalledTimes(1);
    expect(deleteMany).toHaveBeenCalledWith({
      where: { tickerId: TICKER_ID, analyzedAt: null },
    });
    expect(result.skippedByCap).toBe(4);
    expect(result.cappedTickerCount).toBe(1);
  });

  it("does not clear sources for a ticker still under the cap", async () => {
    const { db, deleteMany, findMany } = buildDb({ [TICKER_ID]: 49 });
    findMany.mockResolvedValue([{ id: SEARCH_ARTICLE }]);

    await applyAnalysisPost(
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
    );

    expect(deleteMany).not.toHaveBeenCalled();
  });

  it("queries accepted sections with the section-not-null filter", async () => {
    const { db, count, findMany } = buildDb({ [TICKER_ID]: 50 });
    findMany.mockResolvedValue([{ id: SEARCH_ARTICLE }]);

    await applyAnalysisPost(
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
    );

    expect(count).toHaveBeenCalledWith({
      where: { tickerId: TICKER_ID, section: { not: null } },
    });
  });

  it("never targets ticker_id null when clearing leftovers", async () => {
    const { db, deleteMany, findMany } = buildDb({ [TICKER_ID]: 50 });
    findMany.mockResolvedValue([{ id: SEARCH_ARTICLE }]);

    await applyAnalysisPost(
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
    );

    for (const call of deleteMany.mock.calls) {
      expect(call[0].where.tickerId).toBe(TICKER_ID);
      expect(call[0].where.tickerId).not.toBeNull();
    }
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
