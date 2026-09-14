import { describe, expect, it } from "vitest";
import { zodToJsonSchema } from "zod-to-json-schema";

import {
  articleSummarySchema,
  buildArticlePrompt,
  buildIssuerCoverageDirective,
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

  it("gives Indonesian quantity words their real magnitude", () => {
    expect(SUMMARIZE_ARTICLE_SYSTEM_PROMPT).toContain('"belasan" is 11 to 19');
    expect(SUMMARIZE_ARTICLE_SYSTEM_PROMPT).toContain(
      'never "dozens", which reads as twenty-four or more',
    );
    expect(SUMMARIZE_ARTICLE_SYSTEM_PROMPT).toContain(
      "Never make a vague quantity firmer or larger than the source states",
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

  it("requires a figure's subject to be the measured term, not the article's topic", () => {
    expect(SUMMARIZE_ARTICLE_SYSTEM_PROMPT).toContain(
      "Name a figure's subject with the article's own term for what was measured, never with the article's topic",
    );
    expect(SUMMARIZE_ARTICLE_SYSTEM_PROMPT).toContain(
      'writing "retail consumption" swaps a narrower category onto the number',
    );
    expect(SUMMARIZE_ARTICLE_SYSTEM_PROMPT).toContain(
      "Translate the measured subject, do not replace it",
    );
  });

  it("keeps a measure's regulatory sense when it is translated", () => {
    expect(SUMMARIZE_ARTICLE_SYSTEM_PROMPT).toContain(
      '"aset keuangan digital" is digital financial assets, not digital banking accounts',
    );
  });

  it("refuses a claim the headline makes and the body never establishes", () => {
    expect(SUMMARIZE_ARTICLE_SYSTEM_PROMPT).toContain(
      "A headline is not a source",
    );
    expect(SUMMARIZE_ARTICLE_SYSTEM_PROMPT).toContain(
      "leave out anything the headline states that the body never establishes",
    );
    expect(SUMMARIZE_ARTICLE_SYSTEM_PROMPT).toContain(
      "return no points at all",
    );
  });

  it("requires a claim to name the party who made it", () => {
    expect(SUMMARIZE_ARTICLE_SYSTEM_PROMPT).toContain(
      "Attribute a claim to whoever made it",
    );
    expect(SUMMARIZE_ARTICLE_SYSTEM_PROMPT).toContain(
      "said, claimed, denied, testified, or projected",
    );
    expect(SUMMARIZE_ARTICLE_SYSTEM_PROMPT).toContain(
      "reads to the reader as a settled finding",
    );
  });

  it("requires a figure in the title to appear in a point", () => {
    expect(SUMMARIZE_ARTICLE_SYSTEM_PROMPT).toContain(
      "When your title carries a figure, one of your points must carry that figure too",
    );
    expect(SUMMARIZE_ARTICLE_SYSTEM_PROMPT).toContain(
      "given a headline number the item never evidences",
    );
    expect(SUMMARIZE_ARTICLE_SYSTEM_PROMPT).toContain(
      "with the base it moved from when the article gives one",
    );
  });

  it("extends that to a penalty, threshold, or deadline the title announces", () => {
    expect(SUMMARIZE_ARTICLE_SYSTEM_PROMPT).toContain(
      "if the heading says twelve years in prison, a point states the sentence and what triggers it",
    );
  });

  it("confines an item to the company its headline is about", () => {
    expect(SUMMARIZE_ARTICLE_SYSTEM_PROMPT).toContain(
      "report only the facts about the company its headline is about",
    );
  });

  it("exempts a feature whose headline names no company", () => {
    expect(SUMMARIZE_ARTICLE_SYSTEM_PROMPT).toContain(
      "A feature whose headline names no company is the exception to that rule",
    );
    expect(SUMMARIZE_ARTICLE_SYSTEM_PROMPT).toContain(
      "the headline subject is the trend and not whichever company the article happens to open with",
    );
    expect(SUMMARIZE_ARTICLE_SYSTEM_PROMPT).toContain(
      "naming each company inside its own point",
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

describe("buildArticlePrompt with an issuer", () => {
  const kompasFeature = {
    dataSourceId: "ds-2",
    url: "https://www.kompas.id/artikel/ketika-konglomerat-membidik-bisnis-infrastruktur-ai",
    title: "Ketika Konglomerat Membidik Bisnis Infrastruktur AI",
    content:
      "RAIA Grid dikembangkan oleh IFT. Melalui PT Dian Swastatika Sentosa Tbk (DSSA), " +
      "Sinarmas Group berekspansi ke infrastruktur digital.",
  } as Parameters<typeof buildArticlePrompt>[0];

  it("asks for the subscribed issuer when the article names it", () => {
    const prompt = buildArticlePrompt(kompasFeature, {
      label: "Dian Swastatika Sentosa Tbk (DSSA)",
      names: ["DSSA", "Dian Swastatika Sentosa Tbk"],
    });

    expect(prompt).toContain(
      "This article is being summarized for a newsletter about Dian Swastatika Sentosa Tbk (DSSA)",
    );
    expect(prompt).toContain("Lead with that");
  });

  it("leaves the prompt alone when the article never names the issuer", () => {
    const prompt = buildArticlePrompt(kompasFeature, {
      label: "PT DCI Indonesia Tbk (DCII)",
      names: ["DCII", "DCI Indonesia"],
    });

    expect(prompt).not.toContain("This article is being summarized");
    expect(prompt).toContain(
      "Title: Ketika Konglomerat Membidik Bisnis Infrastruktur AI",
    );
  });

  it("leaves the prompt alone when no issuer is supplied", () => {
    const prompt = buildArticlePrompt(kompasFeature);

    expect(prompt).not.toContain("This article is being summarized");
  });
});

describe("buildIssuerCoverageDirective", () => {
  it("names the issuer the previous summary left out and keeps the fallback", () => {
    const directive = buildIssuerCoverageDirective(
      "Dian Swastatika Sentosa Tbk (DSSA)",
    );

    expect(directive).toContain(
      "named Dian Swastatika Sentosa Tbk (DSSA) in no point",
    );
    expect(directive).toContain(
      "return the summary you wrote before, unchanged",
    );
    expect(directive).toContain(
      "never describe what this article does or does not contain",
    );
  });
});

describe("articleSummarySchema as JSON Schema", () => {
  it("sets no maxLength on a point", () => {
    const json = JSON.stringify(zodToJsonSchema(articleSummarySchema));

    expect(json).not.toContain("maxLength");
  });
});
