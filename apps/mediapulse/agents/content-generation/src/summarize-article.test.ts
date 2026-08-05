import { describe, expect, it } from "vitest";

import {
  articleSummarySchema,
  buildArticlePrompt,
  SUMMARIZE_ARTICLE_SYSTEM_PROMPT,
} from "./summarize-article.js";

describe("articleSummarySchema", () => {
  it("accepts an empty point list so a content-free article can drop out", () => {
    const parsed = articleSummarySchema.safeParse({
      title: "Ministry publishes coal reference price",
      points: [],
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects more points than an article may carry", () => {
    const parsed = articleSummarySchema.safeParse({
      title: "Coal reference price set",
      points: ["a", "b", "c", "d"],
    });

    expect(parsed.success).toBe(false);
  });
});

describe("SUMMARIZE_ARTICLE_SYSTEM_PROMPT", () => {
  it("requires the attributable profit measure to be reported and named", () => {
    expect(SUMMARIZE_ARTICLE_SYSTEM_PROMPT).toContain(
      "Report the attributable figure",
    );
    expect(SUMMARIZE_ARTICLE_SYSTEM_PROMPT).toContain(
      "name the measure inside the point, every time",
    );
  });

  it("requires qualifiers that change a noun's meaning to be carried", () => {
    expect(SUMMARIZE_ARTICLE_SYSTEM_PROMPT).toContain(
      "Carry any qualifier that changes what a noun means",
    );
    expect(SUMMARIZE_ARTICLE_SYSTEM_PROMPT).toContain(
      "must not come away with a wider claim than the article supports",
    );
  });

  it("confines an item to the company its headline is about", () => {
    expect(SUMMARIZE_ARTICLE_SYSTEM_PROMPT).toContain(
      "report only the facts about the company its headline is about",
    );
  });

  it("keeps the guards added for the 2026-08-05 errors", () => {
    expect(SUMMARIZE_ARTICLE_SYSTEM_PROMPT).toContain(
      "Do not repeat a sweep from the headline",
    );
    expect(SUMMARIZE_ARTICLE_SYSTEM_PROMPT).toContain(
      "never from the document title",
    );
  });
});

describe("buildArticlePrompt", () => {
  it("carries the article's title and trimmed body", () => {
    const prompt = buildArticlePrompt({
      dataSourceId: "ds-1",
      url: "https://example.com/a",
      title: "Telkom H1 profit",
      content: "  Telkom booked Rp75.9 trillion in revenue.  ",
    } as Parameters<typeof buildArticlePrompt>[0]);

    expect(prompt).toContain("Title: Telkom H1 profit");
    expect(prompt).toContain("Telkom booked Rp75.9 trillion in revenue.");
    expect(prompt.endsWith(" ")).toBe(false);
  });
});
