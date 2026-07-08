import { describe, expect, it } from "vitest";

import {
  mapRowToDetailItem,
  mapRowToListItem,
  type QueryAnalysisRunListRow,
} from "./list-mapper";

const TICKER_ID = "11111111-1111-4111-a111-111111111111";

const makeRow = (queries: unknown): QueryAnalysisRunListRow => ({
  id: "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa",
  tickerId: TICKER_ID,
  executionId: "exec-1",
  queries: queries as QueryAnalysisRunListRow["queries"],
  createdAt: new Date("2026-07-08T10:00:00.000Z"),
  ticker: { symbol: "FORE" },
});

describe("query-analysis-runs list-mapper", () => {
  it("derives generated/included/rejected counts from the queries json", () => {
    // Setup
    const row = makeRow([
      { text: "q1", included: true, reason: "included — 5 search hits" },
      {
        text: "q2",
        included: false,
        reason: "rejected — 0 search hits (below minimum)",
      },
      {
        text: "q3",
        included: true,
        reason: "included — reinstated for a starved section",
      },
    ]);

    // Act
    const item = mapRowToListItem(row);

    // Assert
    expect(item).toMatchObject({
      tickerSymbol: "FORE",
      generated: 3,
      included: 2,
      rejected: 1,
      executionId: "exec-1",
    });
  });

  it("detail item includes the pretty-printed decision list", () => {
    // Setup
    const decisions = [
      { text: "q1", included: true, reason: "included — 5 search hits" },
    ];

    // Act
    const detail = mapRowToDetailItem(makeRow(decisions));

    // Assert
    expect(detail.tickerId).toBe(TICKER_ID);
    expect(JSON.parse(detail.decisionsJson)).toEqual(decisions);
  });

  it("treats malformed queries json as an empty decision set", () => {
    // Act
    const item = mapRowToListItem(makeRow({ not: "an array" }));

    // Assert
    expect(item).toMatchObject({ generated: 0, included: 0, rejected: 0 });
  });
});
