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
});
