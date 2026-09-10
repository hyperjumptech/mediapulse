import { describe, expect, it } from "vitest";

import {
  foldThinSectionsIntoQuickHits,
  hasRenderableContent,
  MIN_SECTION_ARTICLES,
} from "./default-newsletter.js";
import type {
  NewsletterArticle,
  NewsletterSection,
  NewsletterSectionKey,
} from "./newsletter-document.js";

const article = (title: string, points = ["A point."]): NewsletterArticle => ({
  title,
  url: `https://example.com/${encodeURIComponent(title)}`,
  points,
});

const section = (
  key: NewsletterSectionKey,
  articles: NewsletterArticle[],
): NewsletterSection => ({ key, articles });

describe("hasRenderableContent", () => {
  it("rejects a section whose articles carry no points", () => {
    // Setup
    const empty = section("quick-hits", [article("Nothing", [])]);

    // Assert
    expect(hasRenderableContent(empty)).toBe(false);
  });
});

describe("foldThinSectionsIntoQuickHits", () => {
  it("keeps a section that meets the article floor", () => {
    // Setup
    const sections = [
      section("deals-and-movements", [article("Buyback"), article("Merger")]),
    ];

    // Act
    const folded = foldThinSectionsIntoQuickHits(sections);

    // Assert
    expect(folded).toHaveLength(1);
    expect(folded[0]?.key).toBe("deals-and-movements");
    expect(folded[0]?.articles).toHaveLength(MIN_SECTION_ARTICLES);
  });

  it("moves a single-article section into an existing Quick Hits", () => {
    // Setup
    const sections = [
      section("deals-and-movements", [article("Lone buyback")]),
      section("quick-hits", [article("Award"), article("Outlet opening")]),
    ];

    // Act
    const folded = foldThinSectionsIntoQuickHits(sections);

    // Assert
    expect(folded).toHaveLength(1);
    expect(folded[0]?.key).toBe("quick-hits");
    expect(folded[0]?.articles.map((entry) => entry.title)).toEqual([
      "Award",
      "Outlet opening",
      "Lone buyback",
    ]);
  });

  it("creates Quick Hits when no Quick Hits section shipped", () => {
    // Setup
    const sections = [section("disruptors-or-tech", [article("One rollout")])];

    // Act
    const folded = foldThinSectionsIntoQuickHits(sections);

    // Assert
    expect(folded).toHaveLength(1);
    expect(folded[0]?.key).toBe("quick-hits");
    expect(folded[0]?.articles.map((entry) => entry.title)).toEqual([
      "One rollout",
    ]);
  });

  it("keeps Quick Hits itself even when it holds one article", () => {
    // Setup
    const sections = [section("quick-hits", [article("Lone hit")])];

    // Act
    const folded = foldThinSectionsIntoQuickHits(sections);

    // Assert
    expect(folded).toHaveLength(1);
    expect(folded[0]?.key).toBe("quick-hits");
  });

  it("returns folded sections in canonical display order", () => {
    // Setup
    const sections = [
      section("industry-pulse", [article("Macro one"), article("Macro two")]),
      section("deals-and-movements", [article("Lone buyback")]),
      section("regulatory-policy-watch", [
        article("Rule one"),
        article("Rule two"),
      ]),
    ];

    // Act
    const folded = foldThinSectionsIntoQuickHits(sections);

    // Assert
    expect(folded.map((entry) => entry.key)).toEqual([
      "industry-pulse",
      "regulatory-policy-watch",
      "quick-hits",
    ]);
  });

  it("drops articles that carry no points before counting the floor", () => {
    // Setup
    const sections = [
      section("competitive-landscape", [
        article("Real peer move"),
        article("Empty", []),
      ]),
    ];

    // Act
    const folded = foldThinSectionsIntoQuickHits(sections);

    // Assert
    expect(folded[0]?.key).toBe("quick-hits");
    expect(folded[0]?.articles.map((entry) => entry.title)).toEqual([
      "Real peer move",
    ]);
  });

  it("returns no sections when the document is empty", () => {
    // Act
    const folded = foldThinSectionsIntoQuickHits([]);

    // Assert
    expect(folded).toEqual([]);
  });
});
