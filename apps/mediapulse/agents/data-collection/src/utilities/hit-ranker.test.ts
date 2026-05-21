/** @vitest-environment node */

import { describe, expect, it } from "vitest";

import type { WebSearchResult } from "./web-search";
import {
  applyFetchBudget,
  rankSearchHits,
  snippetMatchScore,
} from "./hit-ranker";

const aliases = ["bbca", "bank central asia"];

/** Builds a minimal search hit fixture. */
const makeHit = (
  overrides: Partial<WebSearchResult> & Pick<WebSearchResult, "url">,
): WebSearchResult => ({
  title: "Headline",
  content: "Snippet",
  tickerId: "ticker-1",
  searchQueryId: "sq-1",
  searchQueryText: "query",
  serpIndex: 0,
  ...overrides,
});

describe("snippetMatchScore", () => {
  it("caps alias matches at three", () => {
    // Act
    const score = snippetMatchScore(
      "BBCA and Bank Central Asia",
      "BBCA Bank Central Asia BBCA",
      aliases,
    );

    // Assert
    expect(score).toBe(3);
  });
});

describe("rankSearchHits", () => {
  it("ranks tier-1 hosts above tier-3 hosts at lower SERP positions", () => {
    // Setup
    const hits = [
      makeHit({
        url: "https://www.medium.com/post",
        serpIndex: 0,
      }),
      makeHit({
        url: "https://www.reuters.com/article",
        serpIndex: 4,
      }),
    ];

    // Act
    const ranked = rankSearchHits(hits, {
      tickerAliases: aliases,
      hostCounts: {},
    });

    // Assert
    expect(ranked[0]?.url).toBe("https://www.reuters.com/article");
  });

  it("applies host-fatigue penalty below fresher tier-2 hosts", () => {
    // Setup
    const hits = [
      makeHit({
        url: "https://www.medium.com/fatigued",
        serpIndex: 0,
      }),
      makeHit({
        url: "https://www.marketwatch.com/fresh",
        serpIndex: 1,
      }),
    ];

    // Act
    const ranked = rankSearchHits(hits, {
      tickerAliases: aliases,
      hostCounts: { "www.medium.com": 4 },
    });

    // Assert
    expect(ranked[0]?.url).toBe("https://www.marketwatch.com/fresh");
  });
});

describe("applyFetchBudget", () => {
  it("keeps three hits per query across two queries", () => {
    // Setup
    const hits = [
      ...Array.from({ length: 5 }, (_, index) =>
        makeHit({
          url: `https://example.com/a-${index}`,
          searchQueryId: "sq-1",
          serpIndex: index,
        }),
      ),
      ...Array.from({ length: 5 }, (_, index) =>
        makeHit({
          url: `https://example.com/b-${index}`,
          searchQueryId: "sq-2",
          serpIndex: index,
        }),
      ),
    ];

    // Act
    const result = applyFetchBudget(hits, {
      tickerAliases: aliases,
      hostCounts: {},
      perQueryFetchBudget: 3,
      perRunFetchBudget: 40,
    });

    // Assert
    expect(result.hits).toHaveLength(6);
    expect(result.droppedByPerQueryBudget).toBe(4);
    expect(result.droppedByPerRunBudget).toBe(0);
  });

  it("caps the round at the per-run fetch budget", () => {
    // Setup
    const hits = Array.from({ length: 8 }, (_, index) =>
      makeHit({
        url: `https://example.com/${index}`,
        searchQueryId: `sq-${index % 4}`,
        serpIndex: index,
      }),
    );

    // Act
    const result = applyFetchBudget(hits, {
      tickerAliases: aliases,
      hostCounts: {},
      perQueryFetchBudget: 2,
      perRunFetchBudget: 6,
    });

    // Assert
    expect(result.hits).toHaveLength(6);
    expect(result.droppedByPerQueryBudget).toBe(0);
    expect(result.droppedByPerRunBudget).toBe(2);
  });
});
