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

  it("omits unsubscribe link when unsubscribeUrl is not set", async () => {
    const { html } = await renderNewsletterEmail({
      title: "T",
      bodyText: "B",
    });
    expect(html).not.toMatch(/unsubscribe/i);
  });

  it("includes unsubscribe link with ticker symbol when unsubscribeUrl is set", async () => {
    const { html } = await renderNewsletterEmail({
      title: "T",
      bodyText: "B",
      unsubscribeUrl: "https://app.example.com/api/unsubscribe?token=abc",
      tickerSymbol: "AAPL",
    });
    // React Email inserts comment nodes between JSX expressions
    expect(html).toMatch(/Unsubscribe from.*AAPL.*updates/i);
    expect(html).toContain("https://app.example.com/api/unsubscribe?token=abc");
  });

  it("shows generic text when tickerSymbol is omitted", async () => {
    const { html } = await renderNewsletterEmail({
      title: "T",
      bodyText: "B",
      unsubscribeUrl: "https://app.example.com/api/unsubscribe?token=abc",
    });
    expect(html).toMatch(/Unsubscribe from.*these.*updates/i);
  });
});
