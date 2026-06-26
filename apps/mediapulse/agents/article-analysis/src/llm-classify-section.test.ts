import { describe, expect, it } from "vitest";

import {
  articleSectionClassificationSchema,
  buildSectionClassificationMessages,
  MAX_CONTENT_CHARS,
} from "./llm-classify-section.js";

const criteria = [
  { section: "competitiveLandscape", criteria: "Rival launches and share." },
  { section: "dealsAndMovements", criteria: "M&A and funding." },
];

describe("buildSectionClassificationMessages", () => {
  it("includes the criteria, labels, title, and content", () => {
    const messages = buildSectionClassificationMessages({
      title: "Acme buys Globex",
      content: "Acme announced an acquisition.",
      acceptanceCriteria: criteria,
    });
    const system = messages[0]!;
    const user = messages[1]!;

    expect(system.role).toBe("system");
    expect(String(user.content)).toContain(
      "competitiveLandscape (Competitive Landscape): Rival launches and share.",
    );
    expect(String(user.content)).toContain("Acme buys Globex");
    expect(String(user.content)).toContain("Acme announced an acquisition.");
  });

  it("truncates long content to MAX_CONTENT_CHARS", () => {
    const longContent = "x".repeat(MAX_CONTENT_CHARS + 500);
    const messages = buildSectionClassificationMessages({
      title: "t",
      content: longContent,
      acceptanceCriteria: criteria,
    });
    const user = messages[1]!;

    expect(String(user.content)).not.toContain(
      "x".repeat(MAX_CONTENT_CHARS + 1),
    );
  });
});

describe("articleSectionClassificationSchema", () => {
  it("accepts a valid assigned classification", () => {
    const parsed = articleSectionClassificationSchema.parse({
      section: "dealsAndMovements",
      score: 0.8,
      reason: "Announces an acquisition.",
    });

    expect(parsed.section).toBe("dealsAndMovements");
  });

  it("accepts a rejection (section null)", () => {
    const parsed = articleSectionClassificationSchema.parse({
      section: null,
      score: 0.1,
      reason: "Does not fit any section.",
    });

    expect(parsed.section).toBeNull();
  });

  it("rejects out-of-range scores", () => {
    expect(() =>
      articleSectionClassificationSchema.parse({
        section: null,
        score: 1.5,
        reason: "x",
      }),
    ).toThrow();
  });
});
