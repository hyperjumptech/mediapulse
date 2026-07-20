/** @vitest-environment node */

import { describe, expect, it } from "vitest";

import {
  getTickerRelevanceTermsQuerySchema,
  getTickerRelevanceTermsResponseSchema,
} from "./ticker-relevance-terms.js";

describe("getTickerRelevanceTermsQuerySchema", () => {
  it("accepts an empty query object", () => {
    // Act
    const parsed = getTickerRelevanceTermsQuerySchema.parse({});

    // Assert
    expect(parsed).toEqual({});
  });
});

describe("getTickerRelevanceTermsResponseSchema", () => {
  it("accepts tickers with their relevance terms", () => {
    // Act
    const parsed = getTickerRelevanceTermsResponseSchema.parse({
      tickers: [
        {
          id: "11111111-1111-4111-a111-111111111111",
          symbol: "BBCA",
          terms: ["BBCA", "Bank Central Asia Tbk", "BCA", "Keuangan"],
        },
      ],
    });

    // Assert
    expect(parsed.tickers).toHaveLength(1);
    expect(parsed.tickers[0]?.terms).toEqual([
      "BBCA",
      "Bank Central Asia Tbk",
      "BCA",
      "Keuangan",
    ]);
  });

  it("accepts a ticker with no terms", () => {
    // Act
    const parsed = getTickerRelevanceTermsResponseSchema.parse({
      tickers: [
        {
          id: "11111111-1111-4111-a111-111111111111",
          symbol: "XYZ",
          terms: [],
        },
      ],
    });

    // Assert
    expect(parsed.tickers[0]?.terms).toEqual([]);
  });
});
