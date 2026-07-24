/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";

import { readNewsletterDocument } from "@workspace/email-templates/newsletter-document";

import {
  TranslateNewsletterError,
  translateNewsletter,
  type TranslateNewsletterObjectFn,
} from "./translate-newsletter.js";

const credentials = { openaiApiKey: "sk-test" };

const sourceContent = JSON.stringify({
  version: 1,
  sections: [
    {
      key: "industry-pulse",
      articles: [
        {
          title: "Revenue climbs",
          url: "https://example.com/a",
          author: "Jane Doe",
          source: "Reuters",
          points: ["Revenue rose 12.5% to $4.2B in Q1 2026.", "Margin held."],
        },
      ],
    },
    {
      key: "quick-hits",
      articles: [
        {
          title: "Margin steady",
          url: "https://example.com/b",
          points: ["Margin held at 30%."],
        },
      ],
    },
  ],
});

/** The five translatable leaves of `sourceContent`, in document order. */
const translatedStrings = [
  "Pendapatan naik",
  "Pendapatan naik 12.5% menjadi $4.2B pada Q1 2026.",
  "Margin bertahan.",
  "Margin stabil",
  "Margin bertahan di 30%.",
];

describe("translateNewsletter", () => {
  it("rebuilds the document with translated strings and maps token usage", async () => {
    const generateObjectFn = vi.fn().mockResolvedValue({
      object: { subject: "Subjek Indonesia", strings: translatedStrings },
      usage: { inputTokens: 120, outputTokens: 80 },
    }) satisfies TranslateNewsletterObjectFn;

    const result = await translateNewsletter(
      {
        subject: "English Subject",
        content: sourceContent,
        targetLanguage: "id",
        model: "gpt-4o-mini",
        credentials,
      },
      generateObjectFn,
    );
    const document = readNewsletterDocument(result.content);

    expect(result.subject).toBe("Subjek Indonesia");
    expect(result.promptTokens).toBe(120);
    expect(result.completionTokens).toBe(80);
    expect(result.totalTokens).toBe(200);
    expect(document?.sections[0]?.articles[0]?.title).toBe("Pendapatan naik");
    expect(document?.sections[0]?.articles[0]?.points).toEqual([
      "Pendapatan naik 12.5% menjadi $4.2B pada Q1 2026.",
      "Margin bertahan.",
    ]);
    expect(document?.sections[1]?.articles[0]?.points).toEqual([
      "Margin bertahan di 30%.",
    ]);
  });

  it("drops list numbers the model echoed back from the numbered prompt", async () => {
    const numberedStrings = translatedStrings.map(
      (value, index) => `${String(index + 1)}. ${value}`,
    );
    const generateObjectFn = vi.fn().mockResolvedValue({
      object: { subject: "Subjek Indonesia", strings: numberedStrings },
    }) satisfies TranslateNewsletterObjectFn;

    const result = await translateNewsletter(
      {
        subject: "English Subject",
        content: sourceContent,
        targetLanguage: "id",
        model: "gpt-4o-mini",
        credentials,
      },
      generateObjectFn,
    );
    const document = readNewsletterDocument(result.content);

    expect(document?.sections[0]?.articles[0]?.title).toBe("Pendapatan naik");
    expect(document?.sections[0]?.articles[0]?.points).toEqual([
      "Pendapatan naik 12.5% menjadi $4.2B pada Q1 2026.",
      "Margin bertahan.",
    ]);
    expect(document?.sections[1]?.articles[0]?.title).toBe("Margin stabil");
    expect(document?.sections[1]?.articles[0]?.points).toEqual([
      "Margin bertahan di 30%.",
    ]);
  });

  it("keeps a leading number that belongs to the copy itself", async () => {
    const numberedSourceContent = JSON.stringify({
      version: 1,
      sections: [
        {
          key: "industry-pulse",
          articles: [
            {
              title: "1. Revenue climbs",
              url: "https://example.com/a",
              points: ["2. Margin held."],
            },
          ],
        },
      ],
    });
    const generateObjectFn = vi.fn().mockResolvedValue({
      object: {
        subject: "Subjek",
        strings: ["1. Pendapatan naik", "2. Margin bertahan."],
      },
    }) satisfies TranslateNewsletterObjectFn;

    const result = await translateNewsletter(
      {
        subject: "English Subject",
        content: numberedSourceContent,
        targetLanguage: "id",
        model: "gpt-4o-mini",
        credentials,
      },
      generateObjectFn,
    );
    const document = readNewsletterDocument(result.content);

    expect(document?.sections[0]?.articles[0]?.title).toBe(
      "1. Pendapatan naik",
    );
    expect(document?.sections[0]?.articles[0]?.points).toEqual([
      "2. Margin bertahan.",
    ]);
  });

  it("leaves a number that does not match the entry position", async () => {
    const generateObjectFn = vi.fn().mockResolvedValue({
      object: {
        subject: "Subjek",
        strings: ["5 Alasan pendapatan naik", ...translatedStrings.slice(1, 5)],
      },
    }) satisfies TranslateNewsletterObjectFn;

    const result = await translateNewsletter(
      {
        subject: "English Subject",
        content: sourceContent,
        targetLanguage: "id",
        model: "gpt-4o-mini",
        credentials,
      },
      generateObjectFn,
    );
    const document = readNewsletterDocument(result.content);

    expect(document?.sections[0]?.articles[0]?.title).toBe(
      "5 Alasan pendapatan naik",
    );
  });

  it("never translates urls, bylines, or section keys", async () => {
    const generateObjectFn = vi.fn().mockResolvedValue({
      object: { subject: "Subjek", strings: translatedStrings },
    }) satisfies TranslateNewsletterObjectFn;

    const result = await translateNewsletter(
      {
        subject: "English Subject",
        content: sourceContent,
        targetLanguage: "id",
        model: "gpt-4o-mini",
        credentials,
      },
      generateObjectFn,
    );
    const document = readNewsletterDocument(result.content);
    const leadArticle = document?.sections[0]?.articles[0];
    const promptedStrings = generateObjectFn.mock.calls[0]?.[0].prompt ?? "";

    expect(document?.sections.map((section) => section.key)).toEqual([
      "industry-pulse",
      "quick-hits",
    ]);
    expect(leadArticle?.url).toBe("https://example.com/a");
    expect(leadArticle?.author).toBe("Jane Doe");
    expect(leadArticle?.source).toBe("Reuters");
    expect(promptedStrings).not.toContain("https://example.com/a");
    expect(promptedStrings).not.toContain("Jane Doe");
  });

  it("passes the source subject and leaf strings into the prompt and constrains the system prompt", async () => {
    const generateObjectFn = vi.fn().mockResolvedValue({
      object: { subject: "x", strings: translatedStrings },
    }) satisfies TranslateNewsletterObjectFn;

    await translateNewsletter(
      {
        subject: "English Subject",
        content: sourceContent,
        targetLanguage: "id",
        model: "gpt-4o-mini",
        credentials,
      },
      generateObjectFn,
    );

    const callArgs = generateObjectFn.mock.calls[0]?.[0];

    expect(callArgs?.prompt).toContain("English Subject");
    expect(callArgs?.prompt).toContain("12.5%");
    expect(callArgs?.system).toContain("Indonesian");
    expect(callArgs?.system).toContain("EXACTLY the same number of entries");
    expect(callArgs?.system).toMatch(/number|figure/i);
    expect(callArgs?.maxRetries).toBe(0);
  });

  it("returns null token counts when usage is absent", async () => {
    const generateObjectFn = vi.fn().mockResolvedValue({
      object: { subject: "s", strings: translatedStrings },
    }) satisfies TranslateNewsletterObjectFn;

    const result = await translateNewsletter(
      {
        subject: "S",
        content: sourceContent,
        targetLanguage: "id",
        model: "gpt-4o-mini",
        credentials,
      },
      generateObjectFn,
    );

    expect(result.promptTokens).toBeNull();
    expect(result.completionTokens).toBeNull();
    expect(result.totalTokens).toBeNull();
  });

  it("fails loudly when the model returns the wrong number of strings", async () => {
    const generateObjectFn = vi.fn().mockResolvedValue({
      object: { subject: "s", strings: translatedStrings.slice(0, 2) },
    }) satisfies TranslateNewsletterObjectFn;

    await expect(
      translateNewsletter(
        {
          subject: "S",
          content: sourceContent,
          targetLanguage: "id",
          model: "gpt-4o-mini",
          credentials,
        },
        generateObjectFn,
      ),
    ).rejects.toBeInstanceOf(TranslateNewsletterError);
  });

  it("rejects a body that is not a valid newsletter document", async () => {
    const generateObjectFn = vi.fn().mockResolvedValue({
      object: { subject: "s", strings: [] },
    }) satisfies TranslateNewsletterObjectFn;

    await expect(
      translateNewsletter(
        {
          subject: "S",
          content: "not a document",
          targetLanguage: "id",
          model: "gpt-4o-mini",
          credentials,
        },
        generateObjectFn,
      ),
    ).rejects.toBeInstanceOf(TranslateNewsletterError);
    expect(generateObjectFn).not.toHaveBeenCalled();
  });
});
