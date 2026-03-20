/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import {
  buildExtractionPrompt,
  EXTRACTION_CONTENT_LIMIT,
} from "./build-extraction-prompt";

describe("buildExtractionPrompt", () => {
  it("injects entity and relation vocabularies with article data", () => {
    // Setup
    const articles = [
      {
        id: "a1",
        title: "BBCA and OJK discuss digital banking",
        url: "https://example.com/a1",
        content: "PT Bank Central Asia Tbk met OJK officials in Jakarta.",
      },
    ];
    const entityTypes = [
      { id: "e1", name: "ORG", description: "Organization" },
    ];
    const relationTypes = [
      { id: "r1", name: "PARTNERS_WITH", description: "Partnership relation" },
    ];

    // Act
    const prompt = buildExtractionPrompt({
      articles,
      entityTypes,
      relationTypes,
    });

    // Assert
    expect(prompt.systemPrompt).toContain("- ORG: Organization");
    expect(prompt.systemPrompt).toContain(
      "- PARTNERS_WITH: Partnership relation",
    );
    expect(prompt.userPrompt).toContain("Article ID: a1");
    expect(prompt.userPrompt).toContain(
      "Title: BBCA and OJK discuss digital banking",
    );
  });

  it("truncates long article content", () => {
    // Setup
    const longContent = "x".repeat(EXTRACTION_CONTENT_LIMIT + 20);
    const articles = [
      {
        id: "a2",
        title: "Long article",
        url: "https://example.com/a2",
        content: longContent,
      },
    ];

    // Act
    const prompt = buildExtractionPrompt({
      articles,
      entityTypes: [{ id: "e1", name: "ORG", description: null }],
      relationTypes: [{ id: "r1", name: "MENTIONS", description: null }],
    });

    // Assert
    expect(prompt.userPrompt).toContain(`${"x".repeat(50)}`);
    expect(prompt.userPrompt).toContain("...");
  });
});
