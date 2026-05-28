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

  it("does not render a ticker digest line under the heading", async () => {
    const { html, text } = await renderNewsletterEmail({
      title: "Morning Briefing",
      bodyText: "Body content",
      tickerSymbol: "AAPL",
    });

    expect(html).not.toMatch(/this digest covers/i);
    expect(text).not.toMatch(/this digest covers/i);
  });

  it("uses a ticker-aware default footer when footerNote is omitted", async () => {
    const { html, text } = await renderNewsletterEmail({
      title: "Morning Briefing",
      bodyText: "Body content",
      tickerSymbol: "TLKM",
    });

    expect(html).toContain(
      "You are receiving this because you subscribed to TLKM updates.",
    );
    expect(text).toContain(
      "You are receiving this because you subscribed to TLKM updates.",
    );
  });

  it("uses the generic default footer when tickerSymbol is omitted", async () => {
    const { html } = await renderNewsletterEmail({
      title: "Morning Briefing",
      bodyText: "Body content",
    });

    expect(html).toContain(
      "You are receiving this because you subscribed to updates.",
    );
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
    expect(text).toContain(DEFAULT_MEDIAPULSE_SITE_URL);
    expect(text).toContain(DEFAULT_HYPERJUMP_SITE_URL);
  });

  it("honours operator-configured branding URLs when provided", async () => {
    // Setup
    const mediapulseSiteUrl = "https://staging.mediapulse.example/";
    const hyperjumpSiteUrl = "https://staging.hyperjump.example/";

    // Act
    const { html, text } = await renderNewsletterEmail({
      title: "Morning Briefing",
      bodyText: "Body content",
      mediapulseSiteUrl,
      hyperjumpSiteUrl,
    });

    // Assert
    expect(html).toMatch(
      new RegExp(
        `<a[^>]+href=["']?${mediapulseSiteUrl}["']?[^>]*>\\s*Mediapulse\\s*</a>`,
        "i",
      ),
    );
    expect(html).toMatch(
      new RegExp(
        `<a[^>]+href=["']?${hyperjumpSiteUrl}["']?[^>]*>\\s*Hyperjump\\s*</a>`,
        "i",
      ),
    );
    expect(html).not.toContain(DEFAULT_MEDIAPULSE_SITE_URL);
    expect(html).not.toContain(DEFAULT_HYPERJUMP_SITE_URL);
    expect(text).toContain(mediapulseSiteUrl);
    expect(text).toContain(hyperjumpSiteUrl);
  });

  it("renders branding link targets together when all props are supplied", async () => {
    const mediapulseSiteUrl = "https://staging.mediapulse.example/";
    const hyperjumpSiteUrl = "https://staging.hyperjump.example/";
    const tickerSymbol = "BBCA";

    const { html, text } = await renderNewsletterEmail({
      title: "Morning Briefing",
      bodyText: "Body content",
      tickerSymbol,
      mediapulseSiteUrl,
      hyperjumpSiteUrl,
    });

    expect(html).not.toMatch(/this digest covers/i);
    expect(html).toMatch(
      new RegExp(
        `<a[^>]+href=["']?${mediapulseSiteUrl}["']?[^>]*>\\s*Mediapulse\\s*</a>`,
        "i",
      ),
    );
    expect(html).toMatch(
      new RegExp(
        `<a[^>]+href=["']?${hyperjumpSiteUrl}["']?[^>]*>\\s*Hyperjump\\s*</a>`,
        "i",
      ),
    );
    expect(text).toContain(mediapulseSiteUrl);
    expect(text).toContain(hyperjumpSiteUrl);
    expect(text).toContain(
      "You are receiving this because you subscribed to BBCA updates.",
    );
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

  it("renders a 'Read the full article' link below each top-news item that has a source URL", async () => {
    // Setup
    const structuredBody = [
      "EXECUTIVE SUMMARY",
      "",
      "Markets rallied today.",
      "",
      "---",
      "",
      "TOP 3 NEWS",
      "",
      "1. Fed holds rates steady",
      "The Federal Reserve announced no change.",
      "Read the full article: https://example.com/fed",
      "",
      "2. Apple beats estimates",
      "Apple reported record quarterly revenue.",
      "Read the full article: https://example.com/apple",
      "",
      "3. Oil prices dip",
      "Crude oil fell 2%.",
      "Read the full article: https://example.com/oil",
    ].join("\n");

    // Act
    const { html, text } = await renderNewsletterEmail({
      title: "Morning Briefing",
      bodyText: structuredBody,
    });

    // Assert — three anchors with the expected label, one per source.
    expect(html.match(/Read the full article/g)?.length).toBe(3);
    expect(html).toContain('href="https://example.com/fed"');
    expect(html).toContain('href="https://example.com/apple"');
    expect(html).toContain('href="https://example.com/oil"');
    expect(text).toContain("https://example.com/fed");
    expect(text).toContain("https://example.com/apple");
    expect(text).toContain("https://example.com/oil");
  });

  it("omits the source link cleanly when a top-news item has no URL", async () => {
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
      "1. With URL",
      "Summary with source.",
      "Read the full article: https://example.com/with-url",
      "",
      "2. Without URL",
      "Summary without source.",
    ].join("\n");

    // Act
    const { html } = await renderNewsletterEmail({
      title: "Morning Briefing",
      bodyText: structuredBody,
    });

    // Assert — only one anchor with the new label, no empty href.
    expect(html.match(/Read the full article/g)?.length).toBe(1);
    expect(html).toContain('href="https://example.com/with-url"');
    expect(html).not.toMatch(/href=""/);
  });

  it("keeps top-news summaries free of leftover 'Read the full article' label text", async () => {
    // Setup
    const structuredBody = [
      "EXECUTIVE SUMMARY",
      "",
      "Markets rallied today.",
      "",
      "---",
      "",
      "TOP 1 NEWS",
      "",
      "1. Fed holds rates steady",
      "The Federal Reserve announced no change to interest rates.",
      "Read the full article: https://example.com/fed",
    ].join("\n");

    // Act
    const { html } = await renderNewsletterEmail({
      title: "Morning Briefing",
      bodyText: structuredBody,
    });

    // Assert — the summary paragraph does not still contain "Read the full article: <url>".
    expect(html).not.toMatch(
      /announced no change to interest rates\.\s*Read the full article:/,
    );
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

  it("renders industry wire bodies with a lead standfirst and eyebrow section headers", async () => {
    const industryBody = [
      "MP_NEWSLETTER",
      "",
      "BEGIN industry-pulse",
      "DISPLAY_HEADING",
      "Industry Pulse / Repairing rather than roaring",
      "PROSE",
      "The telecom market that is repairing rather than roaring sets the tone for this week.",
      "END",
      "",
      "BEGIN competitive-landscape",
      "DISPLAY_HEADING",
      "Competitive Landscape / Battle lines redrawn",
      "BULLET",
      "First mover extended its lead.",
      "BULLET",
      "Second player responded with pricing.",
      "END",
      "",
      "BEGIN deals-and-movements",
      "DISPLAY_HEADING",
      "Deals & Movements",
      "BULLET",
      "A regional acquisition closed.",
      "END",
      "",
      "BEGIN regulatory-policy-watch",
      "DISPLAY_HEADING",
      "Regulatory & Policy Watch / Spectrum watch",
      "BULLET",
      "Agencies hinted at tighter oversight.",
      "END",
      "",
      "BEGIN disruptors-or-tech",
      "DISPLAY_HEADING",
      "Disruptors & Tech / AI at the edge",
      "FORMAT",
      "prose",
      "PROSE",
      "Founders keep shipping faster release cycles.",
      "END",
      "",
      "BEGIN quick-hits",
      "DISPLAY_HEADING",
      "Quick Hits / Five things worth a skim",
      "ITEM",
      "Hit one",
      "ITEM",
      "Hit two",
      "ITEM",
      "Hit three",
      "ITEM",
      "Hit four",
      "ITEM",
      "Hit five",
      "END",
    ].join("\n");

    const { html, text } = await renderNewsletterEmail({
      title: "TLKM industry briefing",
      bodyText: industryBody,
      tickerSymbol: "TLKM",
    });

    const stripped = html.replace(/<!-- -->/g, "");

    expect(stripped).toContain(
      "The telecom market that is repairing rather than roaring sets the tone for this week.",
    );
    expect(stripped).not.toMatch(/Industry Pulse\s*\/\s*Repairing/i);
    expect(stripped).not.toContain(
      "Industry Pulse / Repairing rather than roaring",
    );
    expect(stripped).toContain("Competitive Landscape");
    expect(stripped).toContain("Battle lines redrawn");
    expect(stripped).not.toContain(
      "Competitive Landscape / Battle lines redrawn",
    );
    expect(stripped).toContain("A regional acquisition closed.");
    expect(stripped).not.toMatch(/Deals\s*(?:\/|&amp;|&)\s*Movements\s*\//);
    expect(html).not.toMatch(/Quote of the Week/i);
    expect(html).not.toMatch(/Read, Watch, Listen/i);
    expect(html).not.toMatch(/this digest covers/i);
    expect(html).toContain(
      "You are receiving this because you subscribed to TLKM updates.",
    );

    expect(text).toContain(
      "The telecom market that is repairing rather than roaring sets the tone for this week.",
    );
    expect(text).not.toMatch(/Industry Pulse\s*\/\s*Repairing/i);
    expect(text).not.toContain("Competitive Landscape / Battle lines redrawn");
    expect(text).not.toMatch(/Quote of the Week/i);
    expect(text).not.toMatch(/Read, Watch, Listen/i);
    expect(text).toContain(
      "You are receiving this because you subscribed to TLKM updates.",
    );
  });
});
