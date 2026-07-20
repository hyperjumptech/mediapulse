import { describe, expect, it } from "vitest";

import type { NewsletterDocument } from "@workspace/email-templates/newsletter-document";

import { dedupeCrossSectionEvents } from "./event-dedup.js";

const article = (title: string, text: string, url: string) => ({
  title,
  url,
  points: [text],
});

const sectionOf = (document: NewsletterDocument, key: string) =>
  document.sections.find((section) => section.key === key);

describe("dedupeCrossSectionEvents", () => {
  it("drops a lower-priority article that repeats a higher-priority section's event", () => {
    const document: NewsletterDocument = {
      version: 1,
      sections: [
        {
          key: "competitive-landscape",
          articles: [
            article(
              "Telkomsel wins block",
              "Telkomsel secured the largest 700 spectrum block in the auction, strengthening its position against Indosat.",
              "https://example.com/competitive",
            ),
          ],
        },
        {
          key: "regulatory-policy-watch",
          articles: [
            article(
              "Kominfo concludes auction",
              "Kominfo concluded the 700 spectrum auction, allocating frequencies to Telkomsel, Indosat, and Axiata.",
              "https://example.com/regulatory",
            ),
            article(
              "New numbering rules",
              "Kominfo issued fresh mobile numbering portability rules effective next quarter.",
              "https://example.com/numbering",
            ),
          ],
        },
      ],
    };

    const result = dedupeCrossSectionEvents(document);

    expect(result.removedCount).toBe(1);
    expect(
      sectionOf(result.document, "competitive-landscape")?.articles,
    ).toHaveLength(1);
    const regulatory = sectionOf(result.document, "regulatory-policy-watch");

    expect(regulatory?.articles).toHaveLength(1);
    expect(regulatory?.articles[0]?.title).toBe("New numbering rules");
    expect(result.drops[0]).toMatchObject({
      sectionKey: "regulatory-policy-watch",
      matchedSectionKey: "competitive-landscape",
    });
  });

  it("suppresses an article that repeats the Industry Pulse lead event", () => {
    const document: NewsletterDocument = {
      version: 1,
      sections: [
        {
          key: "industry-pulse",
          articles: [
            article(
              "Spectrum auction concludes",
              "The 700 spectrum auction concluded, with Kominfo allocating frequencies to Telkomsel, Indosat, and Axiata to accelerate national 5G rollout.",
              "https://example.com/lead",
            ),
          ],
        },
        {
          key: "competitive-landscape",
          articles: [
            article(
              "Telkomsel wins block",
              "Telkomsel secured the largest 700 spectrum block in the auction against Indosat and Axiata.",
              "https://example.com/competitive",
            ),
          ],
        },
      ],
    };

    const result = dedupeCrossSectionEvents(document);

    expect(result.removedCount).toBe(1);
    expect(sectionOf(result.document, "competitive-landscape")).toBeUndefined();
    expect(result.drops[0]?.matchedSectionKey).toBe("industry-pulse");
  });

  it("keeps genuinely distinct events that share few anchors", () => {
    const document: NewsletterDocument = {
      version: 1,
      sections: [
        {
          key: "competitive-landscape",
          articles: [
            article(
              "Telkomsel revenue",
              "Telkomsel reported quarterly revenue growth driven by data subscriptions.",
              "https://example.com/revenue",
            ),
          ],
        },
        {
          key: "deals-and-movements",
          articles: [
            article(
              "Axiata acquires fintech",
              "Axiata announced the acquisition of a regional payments startup to expand digital services.",
              "https://example.com/deal",
            ),
          ],
        },
      ],
    };

    const result = dedupeCrossSectionEvents(document);

    expect(result.removedCount).toBe(0);
    expect(
      sectionOf(result.document, "competitive-landscape")?.articles,
    ).toHaveLength(1);
    expect(
      sectionOf(result.document, "deals-and-movements")?.articles,
    ).toHaveLength(1);
  });

  it("drops a section whose only article duplicates a higher-priority event", () => {
    const document: NewsletterDocument = {
      version: 1,
      sections: [
        {
          key: "competitive-landscape",
          articles: [
            article(
              "Telkomsel wins block",
              "Telkomsel secured the largest 700 spectrum block in the auction against Indosat and Axiata.",
              "https://example.com/competitive",
            ),
          ],
        },
        {
          key: "regulatory-policy-watch",
          articles: [
            article(
              "Kominfo concludes auction",
              "Kominfo concluded the 700 spectrum auction, allocating frequencies to Telkomsel, Indosat, and Axiata.",
              "https://example.com/regulatory",
            ),
          ],
        },
      ],
    };

    const result = dedupeCrossSectionEvents(document);

    expect(result.removedCount).toBe(1);
    expect(
      sectionOf(result.document, "competitive-landscape")?.articles,
    ).toHaveLength(1);
    expect(
      sectionOf(result.document, "regulatory-policy-watch"),
    ).toBeUndefined();
  });
});
