import { describe, expect, it } from "vitest";

import { renderNewsletterEmail } from "./index.js";

describe("renderNewsletterEmail", () => {
  it("returns html and plain text containing the title", async () => {
    const { html, text } = await renderNewsletterEmail({
      title: "Hello digest",
      bodyText: "First line\nSecond",
    });
    expect(html).toContain("Hello digest");
    expect(text.toLowerCase()).toContain("hello digest");
    expect(text).toMatch(/first line/i);
  });

  it("omits manage-preferences link when preferencesUrl is not set", async () => {
    const { html } = await renderNewsletterEmail({
      title: "T",
      bodyText: "B",
    });
    expect(html).not.toMatch(/manage preferences/i);
  });

  it("includes manage-preferences link when preferencesUrl is set", async () => {
    const { html } = await renderNewsletterEmail({
      title: "T",
      bodyText: "B",
      preferencesUrl: "https://app.example.com/settings/email",
    });
    expect(html).toMatch(/manage preferences/i);
    expect(html).toContain("https://app.example.com/settings/email");
  });

  it("falls back to static render when stream render is unavailable", async () => {
    // Setup
    const streamError = new TypeError(
      "undefined is not an object (evaluating 'Object.hasOwn(reactDOMServer, \"renderToReadableStream\")')",
    );

    // Act
    const { html, text } = await renderNewsletterEmail(
      {
        title: "Fallback digest",
        bodyText: "Body from fallback",
      },
      {
        renderHtml: async () => {
          throw streamError;
        },
        renderText: async () => {
          throw streamError;
        },
      },
    );

    // Assert
    expect(html).toContain("Fallback digest");
    expect(text).toContain("Fallback digest");
    expect(text).toContain("Body from fallback");
  });

  it("rethrows render errors that are unrelated to stream support", async () => {
    // Setup
    const failure = new Error("render exploded");

    // Act & Assert
    await expect(
      renderNewsletterEmail(
        {
          title: "Will fail",
          bodyText: "Will fail",
        },
        {
          renderHtml: async () => {
            throw failure;
          },
          renderText: async () => "unused",
        },
      ),
    ).rejects.toThrow("render exploded");
  });

  it("renders structured body text with labelled sections", async () => {
    // Setup
    const structuredBody = [
      "EXECUTIVE SUMMARY",
      "",
      "Markets rallied today as tech earnings exceeded expectations.",
      "",
      "---",
      "",
      "TOP 3 NEWS",
      "",
      "1. Fed holds rates steady",
      "The Federal Reserve announced no change to interest rates.",
      "",
      "2. Apple beats estimates",
      "Apple reported record quarterly revenue.",
      "",
      "3. Oil prices dip",
      "Crude oil fell 2% amid easing tensions.",
    ].join("\n");

    // Act
    const { html } = await renderNewsletterEmail({
      title: "Morning Briefing",
      bodyText: structuredBody,
    });

    // Assert
    expect(html).toContain("Executive Summary");
    expect(html).toContain("Top News");
    expect(html).not.toContain("TOP 3 NEWS");
    expect(html).not.toContain("EXECUTIVE SUMMARY");
  });

  it("renders structured news items with numbered bold titles", async () => {
    // Setup
    const structuredBody = [
      "EXECUTIVE SUMMARY",
      "",
      "Markets rallied today.",
      "",
      "---",
      "",
      "TOP 2 NEWS",
      "",
      "1. Fed holds rates steady",
      "The Federal Reserve announced no change.",
      "",
      "2. Apple beats estimates",
      "Apple reported record quarterly revenue.",
    ].join("\n");

    // Act
    const { html } = await renderNewsletterEmail({
      title: "Morning Briefing",
      bodyText: structuredBody,
    });

    // Assert
    const stripped = html.replace(/<!-- -->/g, "");
    expect(stripped).toContain("1. Fed holds rates steady");
    expect(stripped).toContain("The Federal Reserve announced no change.");
    expect(stripped).toContain("2. Apple beats estimates");
    expect(html).toContain("Apple reported record quarterly revenue.");
  });

  it("falls back to plain text rendering for unstructured body text", async () => {
    // Setup
    const freeformBody =
      "Hello,\n\nHere is your newsletter content.\n\n— The team";

    // Act
    const { html } = await renderNewsletterEmail({
      title: "Weekly digest",
      bodyText: freeformBody,
    });

    // Assert
    expect(html).toContain("Here is your newsletter content");
    expect(html).not.toContain("Executive Summary");
    expect(html).not.toContain("Top News");
  });
});
