/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";

vi.mock("@mediapulse/database", () => ({
  prisma: {},
}));

import {
  AnalysisPostValidationError,
  applyAnalysisPost,
  deleteAnalysisDataSource,
  loadAnalysisContext,
} from "./analysis.js";

describe("loadAnalysisContext", () => {
  it("loads unanalyzed sources oldest-first with per-article ticker context and the total backlog count", async () => {
    const rows = [
      {
        id: "11111111-1111-4111-8111-111111111111",
        url: "https://example.com/a",
        title: "A",
        content: "body",
        createdAt: new Date("2026-01-01T00:00:00Z"),
        ticker: {
          symbol: "AGRO",
          name: "PT Bank Raya Indonesia Tbk",
          metadata: {
            Sektor: "Keuangan",
            Industri: "Bank",
            SubIndustri: "Bank",
            KegiatanUsahaUtama: "Perbankan",
          },
        },
      },
      {
        id: "22222222-2222-4222-8222-222222222222",
        url: "https://example.com/b",
        title: "B",
        content: "body",
        createdAt: new Date("2026-01-02T00:00:00Z"),
        ticker: null,
      },
    ];
    const findMany = vi.fn().mockResolvedValue(rows);
    const count = vi.fn().mockResolvedValue(7);

    const result = await loadAnalysisContext(
      { unanalyzed: true, limit: 5 },
      { db: { dataSource: { findMany, count } } as never },
    );

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { collectionGateStatus: "passed", analyzedAt: null },
        orderBy: { createdAt: "asc" },
        take: 5,
        select: expect.objectContaining({
          ticker: { select: { symbol: true, name: true, metadata: true } },
        }),
      }),
    );
    expect(result).toEqual({
      dataSources: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          url: "https://example.com/a",
          title: "A",
          content: "body",
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
        {
          id: "22222222-2222-4222-8222-222222222222",
          url: "https://example.com/b",
          title: "B",
          content: "body",
          createdAt: new Date("2026-01-02T00:00:00Z"),
          ticker: null,
        },
      ],
      dataSourceTotalCount: 7,
    });
  });

  it("drops the analyzedAt filter when unanalyzed is false", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const count = vi.fn().mockResolvedValue(0);

    await loadAnalysisContext(
      { unanalyzed: false },
      { db: { dataSource: { findMany, count } } as never },
    );

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { collectionGateStatus: "passed" } }),
    );
  });
});

describe("applyAnalysisPost", () => {
  const buildDb = () => {
    const update = vi.fn((args) => ({ __update: args }));
    const updateMany = vi.fn((args) => ({ __updateMany: args }));
    const findMany = vi.fn();
    const $transaction = vi.fn((writes: unknown[]) => Promise.resolve(writes));
    return {
      db: { dataSource: { findMany, update, updateMany }, $transaction },
      update,
      updateMany,
      findMany,
      $transaction,
    };
  };

  it("writes section fields, marks analyzed, and returns counts", async () => {
    const { db, update, updateMany, findMany } = buildDb();
    const a = "11111111-1111-4111-8111-111111111111";
    const b = "22222222-2222-4222-8222-222222222222";
    findMany.mockResolvedValue([{ id: a }, { id: b }]);

    const result = await applyAnalysisPost(
      {
        articleSections: [
          {
            dataSourceId: a,
            section: "dealsAndMovements",
            score: 0.9,
            reason: "deal",
          },
          { dataSourceId: b, section: null, score: 0.1, reason: "no fit" },
        ],
        analyzedDataSourceIds: [a, b],
      },
      { db: db as never },
    );

    expect(update).toHaveBeenCalledWith({
      where: { id: a },
      data: {
        section: "dealsAndMovements",
        sectionScore: 0.9,
        sectionReason: "deal",
      },
    });
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: { in: [a, b] } },
      data: { analyzedAt: expect.any(Date) },
    });
    expect(result).toEqual({ articlesScored: 2, articlesRejected: 1 });
  });

  it("throws when a referenced data source is unknown", async () => {
    const { db, findMany } = buildDb();
    const a = "11111111-1111-4111-8111-111111111111";
    findMany.mockResolvedValue([]);

    await expect(
      applyAnalysisPost(
        {
          articleSections: [
            { dataSourceId: a, section: "quickHits", score: 0.5, reason: "x" },
          ],
          analyzedDataSourceIds: [a],
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
      { dataSourceId: "11111111-1111-4111-8111-111111111111", tickerId: "t1" },
      { db: { dataSource: { deleteMany } } as never },
    );

    expect(result).toEqual({ deleted: true });
  });
});
