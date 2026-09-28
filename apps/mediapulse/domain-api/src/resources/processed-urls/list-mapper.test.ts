import { describe, expect, it } from "vitest";

import { mapRowToListItem, type ListRow } from "./list-mapper";

const buildRow = (overrides: Partial<ListRow> = {}): ListRow => ({
  id: "outcome-1",
  scheduleExecutionId: "11111111-1111-4111-a111-111111111111",
  runId: "run-1",
  tickerId: "22222222-2222-4222-a222-222222222222",
  agent: "data_collection",
  status: "collected",
  url: "https://example.com/article",
  reason: null,
  reasonDetail: null,
  source: "acme earnings",
  searchQueryId: null,
  curatedSourceId: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  ticker: { id: "22222222-2222-4222-a222-222222222222", symbol: "ACME" },
  curatedSource: null,
  ...overrides,
});

describe("mapRowToListItem", () => {
  it("exposes the ticker as a generic subject and keeps the legacy symbol", () => {
    const item = mapRowToListItem(buildRow());

    expect(item.subject).toEqual({
      id: "22222222-2222-4222-a222-222222222222",
      label: "ACME",
    });
    expect(item.tickerSymbol).toBe("ACME");
  });

  it("maps a row without a ticker to a null subject and a dash symbol", () => {
    const item = mapRowToListItem(buildRow({ tickerId: null, ticker: null }));

    expect(item.subject).toBeNull();
    expect(item.tickerSymbol).toBe("—");
  });

  it("maps agents, gate status and the curated source", () => {
    const row = buildRow({
      agent: "page_collection",
      status: "dropped",
      reason: "freshness_too_old",
      reasonDetail: "Published 2019-03-12",
      curatedSourceId: "33333333-3333-4333-a333-333333333333",
      curatedSource: {
        id: "33333333-3333-4333-a333-333333333333",
        name: "Example Wire",
        listingUrl: "https://example.com/feed",
      },
    });

    const item = mapRowToListItem(row);

    expect(item).toMatchObject({
      agent: "page-collection",
      status: "dropped",
      gateStatus: "failed",
      reason: "freshness_too_old",
      reasonDetail: "Published 2019-03-12",
      curatedSourceName: "Example Wire",
      curatedSourceListingUrl: "https://example.com/feed",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
  });
});
