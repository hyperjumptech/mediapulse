import { describe, expect, it } from "vitest";

import { flattenBulletsFromNewsletterDocument } from "./flatten-newsletter-bullets.js";

type DocumentArticle = {
  title: string;
  url: string;
  points: string[];
};

const buildDocument = (
  sections: Array<{ key: string; articles: DocumentArticle[] }>,
): string => JSON.stringify({ version: 1, sections });

const article = (title: string, points: string[]): DocumentArticle => ({
  title,
  url: `https://example.com/${title.toLowerCase().replace(/\s+/g, "-")}`,
  points,
});

describe("flattenBulletsFromNewsletterDocument", () => {
  it("returns empty array for content that is not a newsletter document", () => {
    const result = flattenBulletsFromNewsletterDocument(
      "id1",
      "not a document",
      "2024-01-01T00:00:00Z",
    );

    expect(result).toEqual([]);
  });

  it("flattens all sections from a full document", () => {
    const document = buildDocument([
      { key: "industry-pulse", articles: [article("Lead", ["Lead."])] },
      {
        key: "competitive-landscape",
        articles: [
          article("Rival A", ["Rival A underbid."]),
          article("Fleet", ["Fleet oversupply."]),
        ],
      },
      {
        key: "deals-and-movements",
        articles: [article("Deal", ["A deal closed."])],
      },
      {
        key: "quick-hits",
        articles: [article("One", ["One."]), article("Two", ["Two."])],
      },
    ]);

    const result = flattenBulletsFromNewsletterDocument(
      "id1",
      document,
      "2024-01-01T00:00:00Z",
    );

    const sectionKeys = result.map((row) => row.sectionKey);

    expect(sectionKeys).toContain("industryPulse");
    expect(sectionKeys).toContain("competitiveLandscape");
    expect(sectionKeys).toContain("dealsAndMovements");
    expect(sectionKeys).toContain("quickHits");
    expect(
      result.filter((row) => row.sectionKey === "competitiveLandscape"),
    ).toHaveLength(2);
  });

  it("joins an article's points into a single bullet row", () => {
    const document = buildDocument([
      {
        key: "deals-and-movements",
        articles: [article("Deal", ["A deal closed.", "Worth 12 billion."])],
      },
    ]);

    const result = flattenBulletsFromNewsletterDocument(
      "id3",
      document,
      "2024-01-01T00:00:00Z",
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.bulletText).toBe("A deal closed. Worth 12 billion.");
  });

  it("flattens without throwing when competitive-landscape is absent", () => {
    const document = buildDocument([
      { key: "industry-pulse", articles: [article("Lead", ["Lead."])] },
      {
        key: "deals-and-movements",
        articles: [
          article("Deal one", ["A deal closed."]),
          article("Deal two", ["Another deal."]),
        ],
      },
      {
        key: "quick-hits",
        articles: [
          article("Hit one", ["Hit one."]),
          article("Hit two", ["Hit two."]),
        ],
      },
    ]);

    const result = flattenBulletsFromNewsletterDocument(
      "id2",
      document,
      "2024-01-01T00:00:00Z",
    );

    expect(
      result.some((row) => row.sectionKey === "competitiveLandscape"),
    ).toBe(false);
    expect(
      result.filter((row) => row.sectionKey === "dealsAndMovements"),
    ).toHaveLength(2);
    expect(result.filter((row) => row.sectionKey === "quickHits")).toHaveLength(
      2,
    );
    expect(result.every((row) => row.newsletterId === "id2")).toBe(true);
  });
});
