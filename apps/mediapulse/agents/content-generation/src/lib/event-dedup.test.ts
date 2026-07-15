import { describe, expect, it } from "vitest";

import type { IndustryNewsletterResolved } from "../industry-newsletter-urls.js";
import { dedupeCrossSectionEvents } from "./event-dedup.js";

const bullet = (title: string, text: string, url?: string) => ({
  title,
  text,
  ...(url !== undefined ? { url } : {}),
});

describe("dedupeCrossSectionEvents", () => {
  it("drops a lower-priority bullet that repeats a higher-priority section's event", () => {
    const resolved: IndustryNewsletterResolved = {
      subject: "Spectrum",
      competitiveLandscape: {
        displayHeading: "Competitive",
        bullets: [
          bullet(
            "Telkomsel wins block",
            "Telkomsel secured the largest 700 spectrum block in the auction, strengthening its position against Indosat.",
            "https://example.com/competitive",
          ),
        ],
      },
      regulatoryPolicyWatch: {
        displayHeading: "Regulatory",
        bullets: [
          bullet(
            "Kominfo concludes auction",
            "Kominfo concluded the 700 spectrum auction, allocating frequencies to Telkomsel, Indosat, and Axiata.",
            "https://example.com/regulatory",
          ),
          bullet(
            "New numbering rules",
            "Kominfo issued fresh mobile numbering portability rules effective next quarter.",
            "https://example.com/numbering",
          ),
        ],
      },
    };

    const result = dedupeCrossSectionEvents(resolved);

    expect(result.removedCount).toBe(1);
    expect(result.resolved.competitiveLandscape?.bullets).toHaveLength(1);
    expect(result.resolved.regulatoryPolicyWatch?.bullets).toHaveLength(1);
    expect(result.resolved.regulatoryPolicyWatch?.bullets[0]?.title).toBe(
      "New numbering rules",
    );
    expect(result.drops[0]).toMatchObject({
      sectionKey: "regulatoryPolicyWatch",
      matchedSectionKey: "competitiveLandscape",
    });
  });

  it("suppresses a bullet that repeats the Industry Pulse lead event", () => {
    const resolved: IndustryNewsletterResolved = {
      subject: "Spectrum",
      industryPulse: {
        displayHeading: "Industry Pulse",
        prose:
          "The 700 spectrum auction concluded, with Kominfo allocating frequencies to Telkomsel, Indosat, and Axiata to accelerate national 5G rollout.",
        url: "https://example.com/lead",
      },
      competitiveLandscape: {
        displayHeading: "Competitive",
        bullets: [
          bullet(
            "Telkomsel wins block",
            "Telkomsel secured the largest 700 spectrum block in the auction against Indosat and Axiata.",
            "https://example.com/competitive",
          ),
        ],
      },
    };

    const result = dedupeCrossSectionEvents(resolved);

    expect(result.removedCount).toBe(1);
    expect(result.resolved.competitiveLandscape).toBeUndefined();
    expect(result.drops[0]?.matchedSectionKey).toBe("industryPulse");
  });

  it("keeps genuinely distinct events that share few anchors", () => {
    const resolved: IndustryNewsletterResolved = {
      subject: "Mixed",
      competitiveLandscape: {
        displayHeading: "Competitive",
        bullets: [
          bullet(
            "Telkomsel revenue",
            "Telkomsel reported quarterly revenue growth driven by data subscriptions.",
            "https://example.com/revenue",
          ),
        ],
      },
      dealsAndMovements: {
        displayHeading: "Deals",
        bullets: [
          bullet(
            "Axiata acquires fintech",
            "Axiata announced the acquisition of a regional payments startup to expand digital services.",
            "https://example.com/deal",
          ),
        ],
      },
    };

    const result = dedupeCrossSectionEvents(resolved);

    expect(result.removedCount).toBe(0);
    expect(result.resolved.competitiveLandscape?.bullets).toHaveLength(1);
    expect(result.resolved.dealsAndMovements?.bullets).toHaveLength(1);
  });

  it("drops a section whose only bullet duplicates a higher-priority event", () => {
    const resolved: IndustryNewsletterResolved = {
      subject: "Spectrum",
      competitiveLandscape: {
        displayHeading: "Competitive",
        bullets: [
          bullet(
            "Telkomsel wins block",
            "Telkomsel secured the largest 700 spectrum block in the auction against Indosat and Axiata.",
            "https://example.com/competitive",
          ),
        ],
      },
      regulatoryPolicyWatch: {
        displayHeading: "Regulatory",
        bullets: [
          bullet(
            "Kominfo concludes auction",
            "Kominfo concluded the 700 spectrum auction, allocating frequencies to Telkomsel, Indosat, and Axiata.",
            "https://example.com/regulatory",
          ),
        ],
      },
    };

    const result = dedupeCrossSectionEvents(resolved);

    expect(result.removedCount).toBe(1);
    expect(result.resolved.competitiveLandscape?.bullets).toHaveLength(1);
    expect(result.resolved.regulatoryPolicyWatch).toBeUndefined();
  });

  it("keeps uncited items regardless of anchor overlap", () => {
    const resolved: IndustryNewsletterResolved = {
      subject: "Spectrum",
      industryPulse: {
        displayHeading: "Industry Pulse",
        prose:
          "The 700 spectrum auction concluded with Kominfo allocating frequencies to Telkomsel, Indosat, and Axiata.",
        url: "https://example.com/lead",
      },
      competitiveLandscape: {
        displayHeading: "Competitive",
        bullets: [
          bullet(
            "Telkomsel wins block",
            "Telkomsel secured the largest 700 spectrum block in the auction against Indosat and Axiata.",
          ),
        ],
      },
    };

    const result = dedupeCrossSectionEvents(resolved);

    expect(result.removedCount).toBe(0);
    expect(result.resolved.competitiveLandscape?.bullets).toHaveLength(1);
  });
});
