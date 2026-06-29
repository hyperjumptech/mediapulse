/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";

import {
  translateNewsletter,
  type TranslateNewsletterObjectFn,
} from "./translate-newsletter.js";

const credentials = { openaiApiKey: "sk-test" };

const sourceContent = [
  "Industry Pulse",
  "- Revenue rose 12.5% to $4.2B in Q1 2026. [Reuters](https://example.com/a)",
  "- Margin held at 30%. [Bloomberg](https://example.com/b)",
].join("\n");

describe("translateNewsletter", () => {
  it("returns the model's translated subject/content and maps token usage", async () => {
    const generateObjectFn = vi.fn().mockResolvedValue({
      object: { subject: "Subjek Indonesia", content: "Konten Indonesia" },
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

    expect(result).toEqual({
      subject: "Subjek Indonesia",
      content: "Konten Indonesia",
      promptTokens: 120,
      completionTokens: 80,
      totalTokens: 200,
    });
  });

  it("passes the source subject and content into the prompt and constrains the system prompt", async () => {
    const generateObjectFn = vi.fn().mockResolvedValue({
      object: { subject: "x", content: "y" },
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
    expect(callArgs?.prompt).toContain("https://example.com/a");
    expect(callArgs?.prompt).toContain("12.5%");
    expect(callArgs?.system).toContain("Indonesian");
    expect(callArgs?.system).toContain("URL verbatim");
    expect(callArgs?.system).toMatch(/number|figure/i);
    expect(callArgs?.maxRetries).toBe(0);
  });

  it("returns null token counts when usage is absent", async () => {
    const generateObjectFn = vi.fn().mockResolvedValue({
      object: { subject: "s", content: "c" },
    }) satisfies TranslateNewsletterObjectFn;

    const result = await translateNewsletter(
      {
        subject: "S",
        content: "C",
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
});
