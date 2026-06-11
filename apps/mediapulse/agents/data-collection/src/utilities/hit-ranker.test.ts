/** @vitest-environment node */

import { describe, expect, it } from "vitest";

import type { WebSearchResult } from "./web-search";
import { rankSearchHits, snippetMatchScore } from "./hit-ranker";

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
