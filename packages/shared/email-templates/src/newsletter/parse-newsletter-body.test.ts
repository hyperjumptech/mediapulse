import { describe, expect, it } from "vitest";

import { parseNewsletterBody } from "./parse-newsletter-body.js";
import {
  MAX_POINT_LENGTH,
  type NewsletterDocument,
} from "./newsletter-document.js";

/**
 * Serializes a type-checked newsletter document into a stored body string.
 *
 * @param sections - Sections of a valid document.
 * @returns The body string as it would be stored in `Newsletter.content`.
 */
const buildDocumentBody = (sections: NewsletterDocument["sections"]): string =>
  JSON.stringify({ version: 1, sections } satisfies NewsletterDocument);

/**
 * Parses a body that must be a valid newsletter document.
 *
 * @param bodyText - Serialized newsletter document.
 * @returns The validated document.
 */
const expectIndustryDocument = (bodyText: string): NewsletterDocument => {
  const result = parseNewsletterBody(bodyText);
  expect(result).toBeDefined();
  if (result === undefined) {
    throw new Error("expected an industry newsletter document");
  }

  return result;
};

describe("parseNewsletterBody — industry document", () => {
  it("parses a document covering every canonical section", () => {
    // Setup
    const bodyText = buildDocumentBody([
      {
        key: "industry-pulse",
        articles: [
          {
            title: "Week in sector",
            url: "https://example.com/pulse",
            points: ["Lead paragraph only."],
          },
        ],
      },
      {
        key: "competitive-landscape",
        articles: [
          {
            title: "Battle lines",
            url: "https://example.com/a",
            points: [
              "First mover extended its lead.",
              "Second player responded with pricing.",
            ],
          },
        ],
      },
      {
        key: "deals-and-movements",
        articles: [
          {
            title: "Deals desk",
            url: "https://example.com/deals",
            points: ["A regional acquisition closed."],
          },
        ],
      },
      {
        key: "regulatory-policy-watch",
        articles: [
          {
            title: "Policy",
            url: "https://example.com/policy",
            points: ["Agencies hinted at tighter oversight."],
          },
        ],
      },
      {
        key: "disruptors-or-tech",
        articles: [
          {
            title: "Innovation",
            url: "https://example.com/innovation",
            points: ["Founders keep shipping faster release cycles."],
          },
        ],
      },
      {
        key: "quick-hits",
        articles: [
          {
            title: "Hit one",
            url: "https://example.com/a",
            points: ["First short hit."],
          },
          {
            title: "Hit two",
            url: "https://example.com/b",
            points: ["Second short hit."],
          },
          {
            title: "Hit three",
            url: "https://example.com/c",
            points: ["Third short hit."],
          },
        ],
      },
    ]);

    // Act
    const document = expectIndustryDocument(bodyText);

    // Assert
    expect(document.version).toBe(1);
    expect(document.sections).toHaveLength(6);
    expect(document.sections[0]?.key).toBe("industry-pulse");

    const quickHits = document.sections.find(
      (section) => section.key === "quick-hits",
    );

    expect(quickHits).toBeDefined();
    expect(quickHits?.articles).toHaveLength(3);
    expect(quickHits?.articles[0]?.url).toBe("https://example.com/a");
    expect(quickHits?.articles[0]?.title).toBe("Hit one");

    const disruptors = document.sections.find(
      (section) => section.key === "disruptors-or-tech",
    );

    expect(disruptors?.articles).toHaveLength(1);
    expect(disruptors?.articles[0]?.points).toEqual([
      "Founders keep shipping faster release cycles.",
    ]);
  });

  it("parses articles that carry several points plus an optional byline", () => {
    // Setup
    const bodyText = buildDocumentBody([
      {
        key: "industry-pulse",
        articles: [
          {
            title: "Sector holds steady",
            source: "The Star",
            url: "https://example.com/pulse",
            points: [
              "Volumes were flat week over week.",
              "Margins improved on lower input costs.",
            ],
          },
        ],
      },
      {
        key: "quick-hits",
        articles: [
          {
            title: "A short hit",
            url: "https://example.com/hit",
            points: ["A short hit."],
          },
        ],
      },
    ]);

    // Act
    const document = expectIndustryDocument(bodyText);

    // Assert
    expect(document.sections).toHaveLength(2);
    expect(document.sections[0]?.articles[0]?.points).toEqual([
      "Volumes were flat week over week.",
      "Margins improved on lower input costs.",
    ]);
    expect(document.sections[0]?.articles[0]?.url).toBe(
      "https://example.com/pulse",
    );
    expect(document.sections[0]?.articles[0]?.source).toBe("The Star");
    expect(document.sections[0]?.articles[0]?.author).toBeUndefined();
    expect(document.sections[1]?.articles[0]?.source).toBeUndefined();
    expect(document.sections[1]?.articles[0]?.points).toEqual(["A short hit."]);
  });

  it("keeps an author when the document supplies one", () => {
    // Setup
    const bodyText = buildDocumentBody([
      {
        key: "industry-pulse",
        articles: [
          {
            title: "Sector holds steady",
            author: "Jane Doe",
            source: "The Star",
            url: "https://example.com/pulse",
            points: ["Volumes were flat week over week."],
          },
        ],
      },
    ]);

    // Act
    const document = expectIndustryDocument(bodyText);

    // Assert
    expect(document.sections[0]?.articles[0]?.author).toBe("Jane Doe");
  });
});

describe("parseNewsletterBody — industry document validation", () => {
  it("rejects a point longer than 100 characters", () => {
    // Setup
    const overLongPoint = "x".repeat(MAX_POINT_LENGTH + 1);
    const bodyText = JSON.stringify({
      version: 1,
      sections: [
        {
          key: "industry-pulse",
          articles: [
            {
              title: "Sector holds steady",
              url: "https://example.com/pulse",
              points: [overLongPoint],
            },
          ],
        },
      ],
    });

    // Act
    const result = parseNewsletterBody(bodyText);

    // Assert
    expect(result).toBeUndefined();
  });

  it("accepts a point of exactly 100 characters", () => {
    // Setup
    const maximalPoint = "x".repeat(MAX_POINT_LENGTH);
    const bodyText = buildDocumentBody([
      {
        key: "industry-pulse",
        articles: [
          {
            title: "Sector holds steady",
            url: "https://example.com/pulse",
            points: [maximalPoint],
          },
        ],
      },
    ]);

    // Act
    const document = expectIndustryDocument(bodyText);

    // Assert
    expect(document.sections[0]?.articles[0]?.points[0]).toHaveLength(
      MAX_POINT_LENGTH,
    );
  });

  it("rejects an article with more than three points", () => {
    // Setup
    const bodyText = JSON.stringify({
      version: 1,
      sections: [
        {
          key: "industry-pulse",
          articles: [
            {
              title: "Sector holds steady",
              url: "https://example.com/pulse",
              points: ["One.", "Two.", "Three.", "Four."],
            },
          ],
        },
      ],
    });

    // Act
    const result = parseNewsletterBody(bodyText);

    // Assert
    expect(result).toBeUndefined();
  });

  it("rejects an article with no points", () => {
    // Setup
    const bodyText = JSON.stringify({
      version: 1,
      sections: [
        {
          key: "industry-pulse",
          articles: [
            {
              title: "Sector holds steady",
              url: "https://example.com/pulse",
              points: [],
            },
          ],
        },
      ],
    });

    // Act
    const result = parseNewsletterBody(bodyText);

    // Assert
    expect(result).toBeUndefined();
  });

  it("rejects an article without a url", () => {
    // Setup
    const bodyText = JSON.stringify({
      version: 1,
      sections: [
        {
          key: "industry-pulse",
          articles: [
            {
              title: "Sector holds steady",
              points: ["Volumes were flat week over week."],
            },
          ],
        },
      ],
    });

    // Act
    const result = parseNewsletterBody(bodyText);

    // Assert
    expect(result).toBeUndefined();
  });

  it("rejects an article whose url is not a valid URL", () => {
    // Setup
    const bodyText = JSON.stringify({
      version: 1,
      sections: [
        {
          key: "industry-pulse",
          articles: [
            {
              title: "Sector holds steady",
              url: "not-a-url",
              points: ["Volumes were flat week over week."],
            },
          ],
        },
      ],
    });

    // Act
    const result = parseNewsletterBody(bodyText);

    // Assert
    expect(result).toBeUndefined();
  });

  it("rejects an article without a title", () => {
    // Setup
    const bodyText = JSON.stringify({
      version: 1,
      sections: [
        {
          key: "industry-pulse",
          articles: [
            {
              url: "https://example.com/pulse",
              points: ["Volumes were flat week over week."],
            },
          ],
        },
      ],
    });

    // Act
    const result = parseNewsletterBody(bodyText);

    // Assert
    expect(result).toBeUndefined();
  });

  it("rejects an article whose title is blank", () => {
    // Setup
    const bodyText = JSON.stringify({
      version: 1,
      sections: [
        {
          key: "industry-pulse",
          articles: [
            {
              title: "   ",
              url: "https://example.com/pulse",
              points: ["Volumes were flat week over week."],
            },
          ],
        },
      ],
    });

    // Act
    const result = parseNewsletterBody(bodyText);

    // Assert
    expect(result).toBeUndefined();
  });

  it("rejects an unknown section key", () => {
    // Setup
    const bodyText = JSON.stringify({
      version: 1,
      sections: [
        {
          key: "market-mood",
          articles: [
            {
              title: "Sector holds steady",
              url: "https://example.com/pulse",
              points: ["Volumes were flat week over week."],
            },
          ],
        },
      ],
    });

    // Act
    const result = parseNewsletterBody(bodyText);

    // Assert
    expect(result).toBeUndefined();
  });

  it("rejects a section with more than three articles", () => {
    // Setup
    const bodyText = JSON.stringify({
      version: 1,
      sections: [
        {
          key: "quick-hits",
          articles: ["a", "b", "c", "d"].map((slug) => ({
            title: `Hit ${slug}`,
            url: `https://example.com/${slug}`,
            points: ["A short hit."],
          })),
        },
      ],
    });

    // Act
    const result = parseNewsletterBody(bodyText);

    // Assert
    expect(result).toBeUndefined();
  });

  it("rejects a section with no articles", () => {
    // Setup
    const bodyText = JSON.stringify({
      version: 1,
      sections: [{ key: "industry-pulse", articles: [] }],
    });

    // Act
    const result = parseNewsletterBody(bodyText);

    // Assert
    expect(result).toBeUndefined();
  });

  it("rejects a document with no sections", () => {
    // Setup
    const bodyText = JSON.stringify({ version: 1, sections: [] });

    // Act
    const result = parseNewsletterBody(bodyText);

    // Assert
    expect(result).toBeUndefined();
  });

  it("rejects a document whose version is not 1", () => {
    // Setup
    const bodyText = JSON.stringify({
      version: 2,
      sections: [
        {
          key: "industry-pulse",
          articles: [
            {
              title: "Sector holds steady",
              url: "https://example.com/pulse",
              points: ["Volumes were flat week over week."],
            },
          ],
        },
      ],
    });

    // Act
    const result = parseNewsletterBody(bodyText);

    // Assert
    expect(result).toBeUndefined();
  });

  it("returns undefined for malformed JSON", () => {
    // Setup
    const bodyText = '{ "version": 1, "sections": [';

    // Act
    const result = parseNewsletterBody(bodyText);

    // Assert
    expect(result).toBeUndefined();
  });

  it("returns undefined for valid JSON that is not a newsletter document", () => {
    // Setup
    const bodyText = JSON.stringify({ hello: "world" });

    // Act
    const result = parseNewsletterBody(bodyText);

    // Assert
    expect(result).toBeUndefined();
  });

  it("returns undefined for a free-form body that is not a document", () => {
    // Setup
    const bodyText = "Hello,\n\nHere is your newsletter content.\n\nThe team";

    // Act
    const result = parseNewsletterBody(bodyText);

    // Assert
    expect(result).toBeUndefined();
  });

  it("returns undefined for an empty string", () => {
    // Setup
    const bodyText = "";

    // Act
    const result = parseNewsletterBody(bodyText);

    // Assert
    expect(result).toBeUndefined();
  });
});
