import { describe, expect, it } from "vitest";

import type { IndustryNewsletterResolved } from "../industry-newsletter-urls.js";

import {
  dedupeAgainstRecentBullets,
  type RecentBullet,
} from "./cross-run-dedup.js";

const URL_A = "https://source.example/a";
const URL_B = "https://source.example/b";
const basePulse = { displayHeading: "Pulse", prose: "Lead prose." };

const REPEATED_TEXT =
  "Rival launches new premium coffee subscription service nationwide next quarter";
const NOVEL_TEXT =
  "Regulator approves updated banking capital adequacy framework guidance today";

describe("dedupeAgainstRecentBullets", () => {
  it("is a no-op when the recent corpus is empty", () => {
    const resolved: IndustryNewsletterResolved = {
      subject: "S",
      industryPulse: basePulse,
      competitiveLandscape: {
        displayHeading: "Competition",
        bullets: [{ text: REPEATED_TEXT, url: URL_A }],
      },
    };

    const result = dedupeAgainstRecentBullets(resolved, []);

    expect(result.removedCount).toBe(0);
    expect(result.resolved).toBe(resolved);
  });

  it("drops a bullet that repeats a recent bullet and keeps a novel one", () => {
    const resolved: IndustryNewsletterResolved = {
      subject: "S",
      industryPulse: basePulse,
      competitiveLandscape: {
        displayHeading: "Competition",
        bullets: [
          { text: REPEATED_TEXT, url: URL_A },
          { text: NOVEL_TEXT, url: URL_B },
        ],
      },
    };
    const recent: RecentBullet[] = [
      { sectionKey: "competitiveLandscape", bulletText: REPEATED_TEXT },
    ];

    const result = dedupeAgainstRecentBullets(resolved, recent);

    expect(result.resolved.competitiveLandscape?.bullets).toHaveLength(1);
    expect(result.resolved.competitiveLandscape?.bullets[0]?.text).toBe(
      NOVEL_TEXT,
    );
    expect(result.removedCount).toBe(1);
    expect(result.bySection.competitiveLandscape).toBe(1);
  });

  it("keeps uncited bullets (no url) even when their text repeats a recent bullet", () => {
    const resolved: IndustryNewsletterResolved = {
      subject: "S",
      industryPulse: basePulse,
      dealsAndMovements: {
        displayHeading: "Deals",
        bullets: [{ text: REPEATED_TEXT }],
      },
    };
    const recent: RecentBullet[] = [
      { sectionKey: "dealsAndMovements", bulletText: REPEATED_TEXT },
    ];

    const result = dedupeAgainstRecentBullets(resolved, recent);

    expect(result.resolved.dealsAndMovements?.bullets).toHaveLength(1);
    expect(result.removedCount).toBe(0);
  });

  it("never empties a section: rescues the most novel item when every item repeats", () => {
    const resolved: IndustryNewsletterResolved = {
      subject: "S",
      industryPulse: basePulse,
      dealsAndMovements: {
        displayHeading: "Deals",
        bullets: [
          { text: REPEATED_TEXT, url: URL_A },
          { text: NOVEL_TEXT, url: URL_B },
        ],
      },
    };
    // Both generated bullets match a recent bullet, so both would drop without the floor.
    const recent: RecentBullet[] = [
      { sectionKey: "dealsAndMovements", bulletText: REPEATED_TEXT },
      { sectionKey: "dealsAndMovements", bulletText: NOVEL_TEXT },
    ];

    const result = dedupeAgainstRecentBullets(resolved, recent);

    expect(result.resolved.dealsAndMovements).toBeDefined();
    expect(result.resolved.dealsAndMovements?.bullets).toHaveLength(1);
    expect(result.removedCount).toBe(1);
    expect(result.bySection.dealsAndMovements).toBe(1);
  });

  it("applies to quickHits items", () => {
    const resolved: IndustryNewsletterResolved = {
      subject: "S",
      industryPulse: basePulse,
      quickHits: {
        displayHeading: "Quick hits",
        items: [
          { text: REPEATED_TEXT, url: URL_A },
          { text: NOVEL_TEXT, url: URL_B },
        ],
      },
    };
    const recent: RecentBullet[] = [
      { sectionKey: "quickHits", bulletText: REPEATED_TEXT },
    ];

    const result = dedupeAgainstRecentBullets(resolved, recent);

    expect(result.resolved.quickHits?.items).toHaveLength(1);
    expect(result.resolved.quickHits?.items[0]?.text).toBe(NOVEL_TEXT);
    expect(result.bySection.quickHits).toBe(1);
  });
});
