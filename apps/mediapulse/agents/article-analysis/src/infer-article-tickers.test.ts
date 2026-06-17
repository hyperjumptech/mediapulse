/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import {
  inferArticleTickers,
  inferArticleTickersHeuristic,
  type InferArticleTickerCandidate,
} from "./infer-article-tickers.js";

const TICKER_A: InferArticleTickerCandidate = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  symbol: "AAPL",
  name: "Apple Inc.",
  aliases: ["Apple"],
};

const TICKER_B: InferArticleTickerCandidate = {
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  symbol: "MSFT",
  name: "Microsoft Corporation",
  aliases: ["Microsoft"],
};

describe("inferArticleTickersHeuristic", () => {
  it("matches symbol in title with high confidence", () => {
    // Act
    const result = inferArticleTickersHeuristic(
      {
        title: "AAPL shares rise after earnings",
        content: "Unrelated market commentary.",
      },
      [TICKER_A, TICKER_B],
    );

    // Assert
    expect(result).toEqual([
      expect.objectContaining({
        tickerId: TICKER_A.id,
        confidence: 0.95,
      }),
    ]);
  });

  it("matches company name in content head", () => {
    // Act
    const result = inferArticleTickersHeuristic(
      {
        title: "Tech sector update",
        content: "Microsoft Corporation announced new cloud services today.",
      },
      [TICKER_A, TICKER_B],
    );

    // Assert
    expect(result).toEqual([
      expect.objectContaining({
        tickerId: TICKER_B.id,
        confidence: 0.75,
      }),
    ]);
  });

  it("returns empty array when no ticker tokens match", () => {
    // Act
    const result = inferArticleTickersHeuristic(
      {
        title: "Macro overview",
        content: "Bond yields moved without company-specific news.",
      },
      [TICKER_A, TICKER_B],
    );

    // Assert
    expect(result).toEqual([]);
  });
});

describe("inferArticleTickers", () => {
  it("delegates to the injected matcher", () => {
    // Setup
    const inferFn = () => [
      {
        tickerId: TICKER_A.id,
        reasoning: "injected",
        confidence: 1,
      },
    ];

    // Act
    const result = inferArticleTickers(
      { title: "ignored", content: "ignored" },
      [TICKER_A],
      inferFn,
    );

    // Assert
    expect(result).toEqual([
      {
        tickerId: TICKER_A.id,
        reasoning: "injected",
        confidence: 1,
      },
    ]);
  });
});
