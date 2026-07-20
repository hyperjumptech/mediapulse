import { describe, expect, it } from "vitest";

import type { SourceForGeneration } from "../types.js";
import { dedupeCrossSectionSourceEvents } from "./event-dedup.js";

const source = (
  title: string,
  content: string,
  section: string,
): SourceForGeneration => ({
  dataSourceId: `ds-${title}`,
  url: `https://example.com/${encodeURIComponent(title)}`,
  title,
  content,
  section,
});

const titleOf = (sources: readonly SourceForGeneration[]): string[] =>
  sources.map((entry) => entry.title);

describe("dedupeCrossSectionSourceEvents", () => {
  it("drops a lower-priority source that repeats a higher-priority section's event", () => {
    const sources = [
      source(
        "Telkomsel wins block",
        "Telkomsel secured the largest 700 spectrum block in the auction, strengthening its position against Indosat and Axiata.",
        "competitiveLandscape",
      ),
      source(
        "Kominfo concludes auction",
        "Kominfo concluded the 700 spectrum auction, allocating frequencies to Telkomsel, Indosat, and Axiata.",
        "regulatoryPolicyWatch",
      ),
      source(
        "New numbering rules",
        "Kominfo issued fresh mobile numbering portability rules effective next quarter.",
        "regulatoryPolicyWatch",
      ),
    ];

    const result = dedupeCrossSectionSourceEvents(sources);

    expect(result.removedCount).toBe(1);
    expect(titleOf(result.sources)).toEqual([
      "Telkomsel wins block",
      "New numbering rules",
    ]);
    expect(result.drops[0]).toMatchObject({
      sectionKey: "regulatoryPolicyWatch",
      matchedSectionKey: "competitiveLandscape",
    });
  });

  it("suppresses a source that repeats the Industry Pulse lead event", () => {
    const sources = [
      source(
        "Telkomsel wins block",
        "Telkomsel secured the largest 700 spectrum block in the auction against Indosat and Axiata.",
        "competitiveLandscape",
      ),
      source(
        "Spectrum auction concludes",
        "The 700 spectrum auction concluded, with Kominfo allocating frequencies to Telkomsel, Indosat, and Axiata to accelerate national 5G rollout.",
        "industryPulse",
      ),
    ];

    const result = dedupeCrossSectionSourceEvents(sources);

    expect(result.removedCount).toBe(1);
    expect(titleOf(result.sources)).toEqual(["Spectrum auction concludes"]);
    expect(result.drops[0]?.matchedSectionKey).toBe("industryPulse");
  });

  it("keeps genuinely distinct events that share few anchors", () => {
    const sources = [
      source(
        "Telkomsel revenue",
        "Telkomsel reported quarterly revenue growth driven by data subscriptions.",
        "competitiveLandscape",
      ),
      source(
        "Axiata acquires fintech",
        "Axiata announced the acquisition of a regional payments startup to expand digital services.",
        "dealsAndMovements",
      ),
    ];

    const result = dedupeCrossSectionSourceEvents(sources);

    expect(result.removedCount).toBe(0);
    expect(result.sources).toHaveLength(2);
  });

  it("keeps the higher-scoring copy when both candidates sit in the same section", () => {
    const sources = [
      {
        ...source(
          "Auction recap",
          "Kominfo concluded the 700 spectrum auction, allocating frequencies to Telkomsel, Indosat, and Axiata.",
          "regulatoryPolicyWatch",
        ),
        sectionScore: 0.4,
      },
      {
        ...source(
          "Auction result",
          "Kominfo concluded the 700 spectrum auction, allocating frequencies to Telkomsel, Indosat, and Axiata nationwide.",
          "regulatoryPolicyWatch",
        ),
        sectionScore: 0.9,
      },
    ];

    const result = dedupeCrossSectionSourceEvents(sources);

    expect(result.removedCount).toBe(1);
    expect(titleOf(result.sources)).toEqual(["Auction result"]);
  });

  it("preserves the caller's ordering among kept sources", () => {
    const sources = [
      source(
        "Quick note",
        "A minor logistics update from a regional port.",
        "quickHits",
      ),
      source(
        "Policy shift",
        "The ministry revised import licensing thresholds for refined metals.",
        "regulatoryPolicyWatch",
      ),
    ];

    const result = dedupeCrossSectionSourceEvents(sources);

    expect(titleOf(result.sources)).toEqual(["Quick note", "Policy shift"]);
  });
});
