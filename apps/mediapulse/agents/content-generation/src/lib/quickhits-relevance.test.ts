import { describe, expect, it } from "vitest";

import type { NewsletterDocument } from "@workspace/email-templates/newsletter-document";

import type { SourceForGeneration } from "../types.js";
import { filterDemotedQuickHits } from "./quickhits-relevance.js";

const source = (
  overrides: Pick<SourceForGeneration, "url"> & Partial<SourceForGeneration>,
): SourceForGeneration => ({
  title: `title-${overrides.url}`,
  content: "content",
  ...overrides,
});

const article = (title: string, url: string) => ({
  title,
  url,
  points: ["t"],
});

const withQuickHits = (
  articles: Array<{ title: string; url: string; points: string[] }>,
): NewsletterDocument => ({
  version: 1,
  sections: [{ key: "quick-hits", articles }],
});

const quickHitsOf = (document: NewsletterDocument) =>
  document.sections.find((section) => section.key === "quick-hits");

describe("filterDemotedQuickHits", () => {
  it("drops a low-score structured-section article demoted into Quick Hits", () => {
    const document = withQuickHits([
      article("Off-topic", "https://x/off"),
      article("Real hit", "https://x/keep"),
    ]);
    const sources = [
      source({
        url: "https://x/off",
        section: "regulatoryPolicyWatch",
        sectionScore: 0.6,
      }),
      source({
        url: "https://x/keep",
        section: "quickHits",
        sectionScore: 0.8,
      }),
    ];

    const result = filterDemotedQuickHits(document, sources, 0.7);

    expect(result.removedCount).toBe(1);
    expect(
      quickHitsOf(result.document)?.articles.map((quickHit) => quickHit.url),
    ).toEqual(["https://x/keep"]);
  });

  it("keeps a high-score structured article the model placed in Quick Hits", () => {
    const document = withQuickHits([article("Strong", "https://x/strong")]);
    const sources = [
      source({
        url: "https://x/strong",
        section: "competitiveLandscape",
        sectionScore: 0.9,
      }),
    ];

    const result = filterDemotedQuickHits(document, sources, 0.7);

    expect(result.removedCount).toBe(0);
    expect(quickHitsOf(result.document)?.articles).toHaveLength(1);
  });

  it("keeps items assigned Quick Hits and items with no resolvable source", () => {
    const document = withQuickHits([
      article("Assigned QH", "https://x/qh"),
      article("Unknown", "https://x/unknown"),
    ]);
    const sources = [
      source({ url: "https://x/qh", section: "quickHits", sectionScore: 0.2 }),
    ];

    const result = filterDemotedQuickHits(document, sources, 0.7);

    expect(result.removedCount).toBe(0);
    expect(quickHitsOf(result.document)?.articles).toHaveLength(2);
  });

  it("removes the Quick Hits section when every item is a low-score demotion", () => {
    const document = withQuickHits([article("Off", "https://x/a")]);
    const sources = [
      source({
        url: "https://x/a",
        section: "dealsAndMovements",
        sectionScore: 0.4,
      }),
    ];

    const result = filterDemotedQuickHits(document, sources, 0.7);

    expect(result.removedCount).toBe(1);
    expect(quickHitsOf(result.document)).toBeUndefined();
  });

  it("leaves other sections untouched", () => {
    const document: NewsletterDocument = {
      version: 1,
      sections: [
        {
          key: "deals-and-movements",
          articles: [article("Deal", "https://x/deal")],
        },
        { key: "quick-hits", articles: [article("Off", "https://x/a")] },
      ],
    };
    const sources = [
      source({
        url: "https://x/a",
        section: "dealsAndMovements",
        sectionScore: 0.4,
      }),
    ];

    const result = filterDemotedQuickHits(document, sources, 0.7);

    expect(result.document.sections).toHaveLength(1);
    expect(result.document.sections[0]?.key).toBe("deals-and-movements");
  });
});
