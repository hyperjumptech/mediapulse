import { describe, expect, it } from "vitest";

import type { IndustryNewsletterResolved } from "../industry-newsletter-urls.js";
import type { SourceForGeneration } from "../types.js";
import { filterDemotedQuickHits } from "./quickhits-relevance.js";

const source = (
  overrides: Pick<SourceForGeneration, "url"> & Partial<SourceForGeneration>,
): SourceForGeneration => ({
  title: `title-${overrides.url}`,
  content: "content",
  ...overrides,
});

const withQuickHits = (
  items: IndustryNewsletterResolved["quickHits"] extends infer Q
    ? Q extends { items: infer I }
      ? I
      : never
    : never,
): IndustryNewsletterResolved => ({
  subject: "S",
  quickHits: { displayHeading: "Hits", items },
});

describe("filterDemotedQuickHits", () => {
  it("drops a low-score structured-section article demoted into Quick Hits", () => {
    const resolved = withQuickHits([
      { title: "Off-topic", text: "t", url: "https://x/off" },
      { title: "Real hit", text: "t", url: "https://x/keep" },
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

    const result = filterDemotedQuickHits(resolved, sources, 0.7);

    expect(result.removedCount).toBe(1);
    expect(result.resolved.quickHits?.items.map((i) => i.url)).toEqual([
      "https://x/keep",
    ]);
  });

  it("keeps a high-score structured article the model placed in Quick Hits", () => {
    const resolved = withQuickHits([
      { title: "Strong", text: "t", url: "https://x/strong" },
    ]);
    const sources = [
      source({
        url: "https://x/strong",
        section: "competitiveLandscape",
        sectionScore: 0.9,
      }),
    ];

    const result = filterDemotedQuickHits(resolved, sources, 0.7);

    expect(result.removedCount).toBe(0);
    expect(result.resolved.quickHits?.items).toHaveLength(1);
  });

  it("keeps items assigned Quick Hits and items with no resolvable source", () => {
    const resolved = withQuickHits([
      { title: "Assigned QH", text: "t", url: "https://x/qh" },
      { title: "Unknown", text: "t", url: "https://x/unknown" },
    ]);
    const sources = [
      source({ url: "https://x/qh", section: "quickHits", sectionScore: 0.2 }),
    ];

    const result = filterDemotedQuickHits(resolved, sources, 0.7);

    expect(result.removedCount).toBe(0);
    expect(result.resolved.quickHits?.items).toHaveLength(2);
  });

  it("removes the Quick Hits section when every item is a low-score demotion", () => {
    const resolved = withQuickHits([
      { title: "Off", text: "t", url: "https://x/a" },
    ]);
    const sources = [
      source({
        url: "https://x/a",
        section: "dealsAndMovements",
        sectionScore: 0.4,
      }),
    ];

    const result = filterDemotedQuickHits(resolved, sources, 0.7);

    expect(result.removedCount).toBe(1);
    expect(result.resolved.quickHits).toBeUndefined();
  });
});
