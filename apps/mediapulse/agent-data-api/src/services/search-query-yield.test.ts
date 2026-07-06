/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";

vi.mock("@mediapulse/database", () => ({
  prisma: {},
}));

import {
  accumulateYieldSample,
  aggregateSearchQueryYieldForTicker,
  computeDailyQueryYieldCounts,
  finalizeYieldBuckets,
  getQueryYieldSummary,
  parseQueryAttributionByText,
  toUtcRunDate,
  utcDayBoundsForDate,
} from "./search-query-yield";

const TICKER_ID = "11111111-1111-4111-a111-111111111111";
const QUERY_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const QUERY_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const RUN_DATE = new Date("2026-05-20T15:00:00.000Z");

describe("utcDayBoundsForDate", () => {
  it("returns UTC midnight through next-day exclusive bounds", () => {
    const bounds = utcDayBoundsForDate(RUN_DATE);
    expect(bounds.start.toISOString()).toBe("2026-05-20T00:00:00.000Z");
    expect(bounds.end.toISOString()).toBe("2026-05-21T00:00:00.000Z");
  });
});

describe("computeDailyQueryYieldCounts", () => {
  it("counts total and novel articles per search query for one UTC day", async () => {
    const dayBounds = utcDayBoundsForDate(RUN_DATE);
    const findMany = vi
      .fn()
      .mockResolvedValueOnce([
        {
          id: "ds-1",
          url: "https://example.com/novel-a",
          searchQueryId: QUERY_A,
          createdAt: new Date("2026-05-20T10:00:00.000Z"),
        },
        {
          id: "ds-2",
          url: "https://example.com/novel-b",
          searchQueryId: QUERY_B,
          createdAt: new Date("2026-05-20T11:00:00.000Z"),
        },
      ])
      .mockResolvedValueOnce([
        {
          url: "https://example.com/novel-a",
          searchQueryId: QUERY_A,
          createdAt: new Date("2026-05-20T10:00:00.000Z"),
        },
        {
          url: "https://example.com/novel-b",
          searchQueryId: QUERY_B,
          createdAt: new Date("2026-05-20T11:00:00.000Z"),
        },
        {
          url: "https://example.com/legacy",
          searchQueryId: QUERY_A,
          createdAt: new Date("2026-05-01T10:00:00.000Z"),
        },
      ]);

    const counts = await computeDailyQueryYieldCounts(
      { tickerId: TICKER_ID, dayBounds },
      {
        dataSource: { findMany },
        searchQueryYield: { upsert: vi.fn(), findMany: vi.fn() },
        searchQuery: { findMany: vi.fn() },
      },
    );

    expect(counts).toEqual([
      {
        searchQueryId: QUERY_A,
        articleCount: 1,
        novelArticleCount: 1,
      },
      {
        searchQueryId: QUERY_B,
        articleCount: 1,
        novelArticleCount: 1,
      },
    ]);
  });
});

describe("aggregateSearchQueryYieldForTicker", () => {
  it("upserts one SearchQueryYield row per query with daily counts", async () => {
    const upsert = vi.fn().mockResolvedValue({});
    const findMany = vi
      .fn()
      .mockResolvedValueOnce([
        {
          id: "ds-1",
          url: "https://example.com/article",
          searchQueryId: QUERY_A,
          createdAt: new Date("2026-05-20T12:00:00.000Z"),
        },
      ])
      .mockResolvedValueOnce([
        {
          url: "https://example.com/article",
          searchQueryId: QUERY_A,
          createdAt: new Date("2026-05-20T12:00:00.000Z"),
        },
      ]);

    const written = await aggregateSearchQueryYieldForTicker(
      { tickerId: TICKER_ID, runDate: RUN_DATE },
      {
        dataSource: { findMany },
        searchQueryYield: { upsert, findMany: vi.fn() },
        searchQuery: { findMany: vi.fn() },
      },
    );

    expect(written).toBe(1);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          searchQueryId_runDate: {
            searchQueryId: QUERY_A,
            runDate: toUtcRunDate(RUN_DATE),
          },
        },
        create: expect.objectContaining({
          searchQueryId: QUERY_A,
          articleCount: 1,
          novelArticleCount: 1,
        }),
      }),
    );
  });
});

describe("getQueryYieldSummary", () => {
  it("rolls up intent and persona averages from yield rows", async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        articleCount: 2,
        novelArticleCount: 1,
        searchQuery: {
          text: "ACME latest news",
          intent: "breaking",
          set: {
            strategySnapshot: {
              queryAttribution: [
                {
                  text: "ACME latest news",
                  source: "deterministic",
                  intent: "breaking",
                },
              ],
            },
          },
        },
      },
      {
        articleCount: 4,
        novelArticleCount: 3,
        searchQuery: {
          text: "Retail chatter on ACME",
          intent: "sentiment",
          set: {
            strategySnapshot: {
              queryAttribution: [
                {
                  text: "Retail chatter on ACME",
                  persona: "retail",
                  source: "llm",
                  intent: "sentiment",
                },
              ],
            },
          },
        },
      },
    ]);

    const summary = await getQueryYieldSummary(
      { tickerId: TICKER_ID, windowDays: 30 },
      {
        dataSource: { findMany: vi.fn() },
        searchQueryYield: { upsert: vi.fn(), findMany },
        searchQuery: { findMany: vi.fn() },
      },
    );

    expect(summary.perIntent).toEqual([
      {
        intent: "breaking",
        avgArticles: 2,
        avgNovel: 1,
      },
      {
        intent: "sentiment",
        avgArticles: 4,
        avgNovel: 3,
      },
    ]);
    expect(summary.perPersona).toEqual([
      {
        persona: "retail",
        avgArticles: 4,
        avgNovel: 3,
      },
    ]);
  });
});

describe("parseQueryAttributionByText", () => {
  it("indexes attribution rows by normalized query text", () => {
    const map = parseQueryAttributionByText({
      queryAttribution: [{ text: "  ACME   news ", persona: "analyst" }],
    });
    expect(map.get("acme news")).toEqual({
      text: "  ACME   news ",
      persona: "analyst",
    });
  });
});

describe("finalizeYieldBuckets", () => {
  it("averages accumulated totals per bucket key", () => {
    const map = new Map<
      string,
      { articleTotal: number; novelTotal: number; sampleCount: number }
    >();
    accumulateYieldSample(map, "fundamental", 4, 2);
    accumulateYieldSample(map, "fundamental", 2, 0);
    expect(finalizeYieldBuckets(map, "intent")).toEqual([
      {
        intent: "fundamental",
        avgArticles: 3,
        avgNovel: 1,
      },
    ]);
  });
});
