import { describe, expect, it } from "vitest";

import {
  DEFAULT_HYPERJUMP_SITE_URL,
  DEFAULT_MEDIAPULSE_SITE_URL,
  renderNewsletterEmail,
} from "./index.js";

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

  it("renders a ticker line under the heading when tickerSymbol is set", async () => {
    // Act
    const { html, text } = await renderNewsletterEmail({
      title: "Morning Briefing",
      bodyText: "Body content",
      tickerSymbol: "AAPL",
    });

    // Assert
    const stripped = html.replace(/<!-- -->/g, "");
    expect(stripped).toContain("This digest covers");
    expect(stripped).toMatch(/<strong[^>]*>\s*AAPL\s*<\/strong>/i);
    const tickerLineIndex = stripped.indexOf("This digest covers");
    const firstHrIndex = stripped.search(/<hr[^>]*>/i);
    expect(tickerLineIndex).toBeGreaterThan(-1);
    expect(firstHrIndex).toBeGreaterThan(-1);
    expect(tickerLineIndex).toBeLessThan(firstHrIndex);
    expect(text).toMatch(/this digest covers/i);
    expect(text).toContain("AAPL");
  });

  it("hides the ticker line when tickerSymbol is omitted", async () => {
    // Act
    const { html } = await renderNewsletterEmail({
      title: "Morning Briefing",
      bodyText: "Body content",
    });

    // Assert
    expect(html).not.toMatch(/this digest covers/i);
  });

  it("hides the ticker line when tickerSymbol is blank", async () => {
    // Act
    const { html } = await renderNewsletterEmail({
      title: "Morning Briefing",
      bodyText: "Body content",
      tickerSymbol: "   ",
    });

    // Assert
    expect(html).not.toMatch(/this digest covers/i);
  });

  it("renders default Mediapulse and Hyperjump branding links in the footer", async () => {
    // Act
    const { html, text } = await renderNewsletterEmail({
      title: "Morning Briefing",
      bodyText: "Body content",
    });

    // Assert
    expect(html).toMatch(
      new RegExp(
        `<a[^>]+href=["']?${DEFAULT_MEDIAPULSE_SITE_URL}["']?[^>]*>\\s*Mediapulse\\s*</a>`,
        "i",
      ),
    );
    expect(html).toMatch(
      new RegExp(
        `<a[^>]+href=["']?${DEFAULT_HYPERJUMP_SITE_URL}["']?[^>]*>\\s*Hyperjump\\s*</a>`,
        "i",
      ),
    );
    expect(text.toLowerCase()).toContain("mediapulse");
    expect(text.toLowerCase()).toContain("hyperjump");
  });

  it("honours operator-configured branding URLs when provided", async () => {
    // Setup
    const mediapulseSiteUrl = "https://staging.mediapulse.example/";
    const hyperjumpSiteUrl = "https://staging.hyperjump.example/";

    // Act
    const { html } = await renderNewsletterEmail({
      title: "Morning Briefing",
      bodyText: "Body content",
      mediapulseSiteUrl,
      hyperjumpSiteUrl,
    });

    // Assert
    expect(html).toContain(mediapulseSiteUrl);
    expect(html).toContain(hyperjumpSiteUrl);
    expect(html).not.toContain(DEFAULT_MEDIAPULSE_SITE_URL);
    expect(html).not.toContain(DEFAULT_HYPERJUMP_SITE_URL);
  });

  it("places the branding block above the subscription footer note", async () => {
    // Setup
    const footerNote = "You are receiving this because you subscribed.";

    // Act
    const { html } = await renderNewsletterEmail({
      title: "Morning Briefing",
      bodyText: "Body content",
      footerNote,
    });

    // Assert
    const brandingIndex = html.indexOf("Brought to you by");
    const footerNoteIndex = html.indexOf(footerNote);
    expect(brandingIndex).toBeGreaterThan(-1);
    expect(footerNoteIndex).toBeGreaterThan(-1);
    expect(brandingIndex).toBeLessThan(footerNoteIndex);
  });

  it("renders markdown links in structured summaries as HTML anchors", async () => {
    const articleUrl = "https://www.investing.com/equities/bnk-central-as";
    const structuredBody = [
      "EXECUTIVE SUMMARY",
      "",
      "Overview with [Bank Central Asia](" + articleUrl + ") in the lead.",
      "",
      "---",
      "",
      "TOP 1 NEWS",
      "",
      "1. BBCA profit strength",
      "[Bank Central Asia](" + articleUrl + ") reported strong net profit.",
    ].join("\n");

    const { html, text } = await renderNewsletterEmail({
      title: "BBCA digest",
      bodyText: structuredBody,
    });

    expect(html).toMatch(
      /<a[^>]+href=["']?https:\/\/www\.investing\.com\/equities\/bnk-central-as["']?/i,
    );
    expect(html).toContain("Bank Central Asia");
    expect(html).not.toContain("[Bank Central Asia](");
    expect(text).toContain("Bank Central Asia");
    expect(text).toContain(articleUrl);
  });
});
