import { describe, expect, it } from "vitest";

import type { NewsletterDocument } from "@workspace/email-templates/newsletter-document";

import {
  dedupeAgainstRecentBullets,
  type RecentBullet,
} from "./cross-run-dedup.js";

const URL_A = "https://source.example/a";
const URL_B = "https://source.example/b";

const REPEATED_TEXT =
  "Rival launches new premium coffee subscription service nationwide next quarter";
const NOVEL_TEXT =
  "Regulator approves updated banking capital adequacy framework guidance today";

const article = (title: string, text: string, url: string) => ({
  title,
  url,
  points: [text],
});

const sectionOf = (document: NewsletterDocument, key: string) =>
  document.sections.find((section) => section.key === key);

describe("dedupeAgainstRecentBullets", () => {
  it("is a no-op when the recent corpus is empty", () => {
    const document: NewsletterDocument = {
      version: 1,
      sections: [
        {
          key: "competitive-landscape",
          articles: [article("Rival", REPEATED_TEXT, URL_A)],
        },
      ],
    };

    const result = dedupeAgainstRecentBullets(document, []);

    expect(result.removedCount).toBe(0);
    expect(result.document).toBe(document);
  });

  it("drops an article that repeats a recent bullet and keeps a novel one", () => {
    const document: NewsletterDocument = {
      version: 1,
      sections: [
        {
          key: "competitive-landscape",
          articles: [
            article("Rival", REPEATED_TEXT, URL_A),
            article("Regulator", NOVEL_TEXT, URL_B),
          ],
        },
      ],
    };
    const recent: RecentBullet[] = [
      { sectionKey: "competitiveLandscape", bulletText: REPEATED_TEXT },
    ];

    const result = dedupeAgainstRecentBullets(document, recent);
    const section = sectionOf(result.document, "competitive-landscape");

    expect(section?.articles).toHaveLength(1);
    expect(section?.articles[0]?.points[0]).toBe(NOVEL_TEXT);
    expect(result.removedCount).toBe(1);
    expect(result.bySection["competitive-landscape"]).toBe(1);
  });

  it("never empties a section: rescues the most novel item when every item repeats", () => {
    const document: NewsletterDocument = {
      version: 1,
      sections: [
        {
          key: "deals-and-movements",
          articles: [
            article("Rival", REPEATED_TEXT, URL_A),
            article("Regulator", NOVEL_TEXT, URL_B),
          ],
        },
      ],
    };
    // Both generated articles match a recent bullet, so both would drop without the floor.
    const recent: RecentBullet[] = [
      { sectionKey: "dealsAndMovements", bulletText: REPEATED_TEXT },
      { sectionKey: "dealsAndMovements", bulletText: NOVEL_TEXT },
    ];

    const result = dedupeAgainstRecentBullets(document, recent);
    const section = sectionOf(result.document, "deals-and-movements");

    expect(section).toBeDefined();
    expect(section?.articles).toHaveLength(1);
    expect(result.removedCount).toBe(1);
    expect(result.bySection["deals-and-movements"]).toBe(1);
  });

  it("applies to quick-hits articles", () => {
    const document: NewsletterDocument = {
      version: 1,
      sections: [
        {
          key: "quick-hits",
          articles: [
            article("Rival", REPEATED_TEXT, URL_A),
            article("Regulator", NOVEL_TEXT, URL_B),
          ],
        },
      ],
    };
    const recent: RecentBullet[] = [
      { sectionKey: "quickHits", bulletText: REPEATED_TEXT },
    ];

    const result = dedupeAgainstRecentBullets(document, recent);
    const section = sectionOf(result.document, "quick-hits");

    expect(section?.articles).toHaveLength(1);
    expect(section?.articles[0]?.points[0]).toBe(NOVEL_TEXT);
    expect(result.bySection["quick-hits"]).toBe(1);
  });
});
