import { describe, expect, it } from "vitest";

import {
  DEFAULT_HYPERJUMP_SITE_URL,
  DEFAULT_MEDIAPULSE_SITE_URL,
  renderNewsletterEmail,
} from "./index.js";
import {
  NEWSLETTER_PREVIEW_PROPS,
  SECTION_COPY,
} from "./newsletter/default-newsletter.js";
import {
  MAX_POINTS_PER_ARTICLE,
  MAX_POINT_LENGTH,
  NEWSLETTER_SECTION_KEYS,
  readNewsletterDocument,
  type NewsletterDocument,
} from "./newsletter/newsletter-document.js";

/**
 * Serializes a type-checked newsletter document into a stored body string.
 *
 * @param sections - Sections of a valid document.
 * @returns The body string as it would be stored in `Newsletter.content`.
 */
const buildDocumentBody = (sections: NewsletterDocument["sections"]): string =>
  JSON.stringify({ version: 1, sections } satisfies NewsletterDocument);

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

  it("renders default MediaPulse and Hyperjump branding links in the footer", async () => {
    // Act
    const { html, text } = await renderNewsletterEmail({
      title: "Morning Briefing",
      bodyText: "Body content",
    });

    // Assert
    expect(html).toMatch(
      new RegExp(
        `<a[^>]+href=["']?${DEFAULT_MEDIAPULSE_SITE_URL}["']?[^>]*>\\s*MediaPulse\\s*</a>`,
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
        `<a[^>]+href=["']?${mediapulseSiteUrl}["']?[^>]*>\\s*MediaPulse\\s*</a>`,
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
        `<a[^>]+href=["']?${mediapulseSiteUrl}["']?[^>]*>\\s*MediaPulse\\s*</a>`,
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

  it("invites subscribers to reply with feedback in the footer", async () => {
    const { html, text } = await renderNewsletterEmail({
      title: "Morning Briefing",
      bodyText: "Body content",
    });

    expect(html).toMatch(/reply to this email/i);
    expect(text).toMatch(/reply to this email/i);
  });

  it("renders an article link for each industry article", async () => {
    // Setup
    const industryBody = buildDocumentBody([
      {
        key: "industry-pulse",
        articles: [
          {
            title: "The sector is shifting",
            url: "https://lead.example/article",
            points: ["The sector is shifting rapidly."],
          },
        ],
      },
      {
        key: "quick-hits",
        articles: [
          {
            title: "Hit one",
            url: "https://example.com/hit-one",
            points: ["Hit one detail."],
          },
        ],
      },
    ]);

    // Act
    const { html, text } = await renderNewsletterEmail({
      title: "Industry Briefing",
      bodyText: industryBody,
    });

    // Assert
    expect(html).toContain("The sector is shifting rapidly.");
    expect(html).toContain('href="https://lead.example/article"');
    expect(html).toContain('href="https://example.com/hit-one"');
    expect(html).toContain("Read the full article");
    expect(text).toContain("https://lead.example/article");
  });

  it("labels the article link generically instead of repeating the article title", async () => {
    // Setup
    const industryBody = buildDocumentBody([
      {
        key: "industry-pulse",
        articles: [
          {
            title: "Indonesia's Digital Banking Evolution and Trends",
            url: "https://lead.example/digital-banking",
            points: ["Paylater services reached Rp43.28 trillion."],
          },
        ],
      },
    ]);

    // Act
    const { html } = await renderNewsletterEmail({
      title: "Industry Briefing",
      bodyText: industryBody,
    });

    // Assert
    const stripped = html.replace(/<!-- -->/g, "");

    expect(stripped).toContain(
      "Indonesia&#x27;s Digital Banking Evolution and Trends",
    );
    expect(stripped).toContain("Read the full article");
    expect(stripped).not.toMatch(
      /Read the full article[^<]*Indonesia&#x27;s Digital Banking/,
    );
    expect(html).toContain('href="https://lead.example/digital-banking"');
  });

  it("never leaks a raw read-the-full-article label into the rendered body", async () => {
    // Setup
    const industryBody = buildDocumentBody([
      {
        key: "industry-pulse",
        articles: [
          {
            title: "A quiet week",
            url: "https://example.com/quiet-week",
            points: ["The sector is quiet this week."],
          },
        ],
      },
    ]);

    // Act
    const { html } = await renderNewsletterEmail({
      title: "Industry Briefing",
      bodyText: industryBody,
    });

    // Assert
    // The wire-format marker is "Read the full article: <url>". Match on that `: <url>` tail rather
    // than the phrase alone, which the rendered link label shares by design.
    expect(html).toContain("The sector is quiet this week.");
    expect(html).not.toMatch(/Read the full article:\s*https?:/i);
    expect(html).toContain("Read the full article…");
  });

  it("renders a body starting at the first section present when industry-pulse is absent", async () => {
    // Setup
    const industryBody = buildDocumentBody([
      {
        key: "quick-hits",
        articles: [
          {
            title: "Hit one",
            url: "https://example.com/hit-one",
            points: ["Hit one detail."],
          },
          {
            title: "Hit two",
            url: "https://example.com/hit-two",
            points: ["Hit two detail."],
          },
          {
            title: "Hit three",
            url: "https://example.com/hit-three",
            points: ["Hit three detail."],
          },
        ],
      },
    ]);

    // Act
    const { html } = await renderNewsletterEmail({
      title: "Industry Briefing",
      bodyText: industryBody,
    });

    // Assert
    const stripped = html.replace(/<!-- -->/g, "");

    expect(stripped).toContain(SECTION_COPY.en["quick-hits"].label);
    expect(stripped).not.toContain(SECTION_COPY.en["industry-pulse"].label);
    expect(stripped).toContain("Hit one");
    expect(stripped).toContain("Hit two");
    expect(stripped).toContain("Hit three");
  });

  it("renders industry documents with canonical section labels, a glossary, and no body title", async () => {
    // Setup
    const industryBody = buildDocumentBody([
      {
        key: "industry-pulse",
        articles: [
          {
            title: "Repairing rather than roaring",
            url: "https://example.com/pulse",
            points: [
              "The telecom market is repairing rather than roaring this week.",
            ],
          },
        ],
      },
      {
        key: "competitive-landscape",
        articles: [
          {
            title: "Battle lines redrawn",
            url: "https://example.com/competition",
            points: [
              "First mover extended its lead.",
              "Second player responded with pricing.",
            ],
          },
        ],
      },
      {
        key: "deals-and-movements",
        articles: [
          {
            title: "Deals desk",
            url: "https://example.com/deals",
            points: ["A regional acquisition closed."],
          },
        ],
      },
      {
        key: "regulatory-policy-watch",
        articles: [
          {
            title: "Spectrum watch",
            url: "https://example.com/policy",
            points: ["Agencies hinted at tighter oversight."],
          },
        ],
      },
      {
        key: "disruptors-or-tech",
        articles: [
          {
            title: "AI at the edge",
            url: "https://example.com/tech",
            points: ["Founders keep shipping faster release cycles."],
          },
        ],
      },
      {
        key: "quick-hits",
        articles: [
          {
            title: "Hit one",
            url: "https://example.com/hit-one",
            points: ["Hit one detail."],
          },
          {
            title: "Hit two",
            url: "https://example.com/hit-two",
            points: ["Hit two detail."],
          },
          {
            title: "Hit three",
            url: "https://example.com/hit-three",
            points: ["Hit three detail."],
          },
        ],
      },
    ]);

    // Act
    const { html, text } = await renderNewsletterEmail({
      title: "TLKM industry briefing",
      bodyText: industryBody,
      tickerSymbol: "TLKM",
    });

    // Assert
    const stripped = html.replace(/<!-- -->/g, "");

    expect(stripped).toContain(
      "The telecom market is repairing rather than roaring this week.",
    );
    expect(stripped).toContain(SECTION_COPY.en["industry-pulse"].label);
    expect(stripped).toContain(SECTION_COPY.en["competitive-landscape"].label);
    expect(stripped).not.toMatch(/<h1[^>]*>[^<]*TLKM industry briefing/i);
    expect(stripped).toContain(
      SECTION_COPY.en["deals-and-movements"].description,
    );
    expect(stripped).toContain("A regional acquisition closed.");
    expect(html).not.toMatch(/Quote of the Week/i);
    expect(html).not.toMatch(/Read, Watch, Listen/i);
    expect(html).not.toMatch(/this digest covers/i);
    expect(html).toContain(
      "You are receiving this because you subscribed to TLKM updates.",
    );

    expect(text).toContain(
      "The telecom market is repairing rather than roaring this week.",
    );
    expect(text).not.toMatch(/Quote of the Week/i);
    expect(text).not.toMatch(/Read, Watch, Listen/i);
    expect(text).toContain(
      "You are receiving this because you subscribed to TLKM updates.",
    );
  });

  it("renders every summary point of an article as its own list item", async () => {
    // Setup
    const industryBody = buildDocumentBody([
      {
        key: "quick-hits",
        articles: [
          {
            title: "Hit one",
            url: "https://example.com/hit-one",
            points: ["First point.", "Second point.", "Third point."],
          },
        ],
      },
    ]);

    // Act
    const { html } = await renderNewsletterEmail({
      title: "Industry Briefing",
      bodyText: industryBody,
    });

    // Assert
    const stripped = html.replace(/<!-- -->/g, "");
    const listItems = stripped.match(/<li[^>]*>/g) ?? [];

    expect(listItems).toHaveLength(3);
    expect(stripped).toContain("First point.");
    expect(stripped).toContain("Second point.");
    expect(stripped).toContain("Third point.");
  });

  it("renders a byline from the article author and source", async () => {
    // Setup
    const industryBody = buildDocumentBody([
      {
        key: "industry-pulse",
        articles: [
          {
            title: "With a full byline",
            author: "Jane Doe",
            source: "Market Wire",
            url: "https://example.com/byline",
            points: ["Point one."],
          },
          {
            title: "With a source only",
            source: "Telecom Daily",
            url: "https://example.com/source-only",
            points: ["Point two."],
          },
          {
            title: "With no byline at all",
            url: "https://example.com/no-byline",
            points: ["Point three."],
          },
        ],
      },
    ]);

    // Act
    const { html } = await renderNewsletterEmail({
      title: "Industry Briefing",
      bodyText: industryBody,
    });

    // Assert
    const stripped = html.replace(/<!-- -->/g, "");

    expect(stripped).toContain("By Jane Doe · Market Wire");
    expect(stripped).toContain("Telecom Daily");
    expect(stripped).toContain("With no byline at all");
  });

  it("renders each section description under its heading, only for sections present in the issue", async () => {
    // Setup
    const partialBody = buildDocumentBody([
      {
        key: "industry-pulse",
        articles: [
          {
            title: "Repairing rather than roaring",
            url: "https://example.com/pulse",
            points: ["The telecom market is repairing rather than roaring."],
          },
        ],
      },
      {
        key: "deals-and-movements",
        articles: [
          {
            title: "Deals",
            url: "https://example.com/deals",
            points: ["A regional acquisition closed."],
          },
        ],
      },
    ]);

    // Act
    const { html } = await renderNewsletterEmail({
      title: "TLKM industry briefing",
      bodyText: partialBody,
      tickerSymbol: "TLKM",
    });

    // Assert
    const stripped = html.replace(/<!-- -->/g, "");
    const pulseLabelIndex = stripped.indexOf(
      SECTION_COPY.en["industry-pulse"].label,
    );
    const pulseDescriptionIndex = stripped.indexOf(
      SECTION_COPY.en["industry-pulse"].description,
    );
    const firstArticleIndex = stripped.indexOf("Repairing rather than roaring");

    expect(pulseLabelIndex).toBeGreaterThan(-1);
    expect(pulseDescriptionIndex).toBeGreaterThan(pulseLabelIndex);
    expect(firstArticleIndex).toBeGreaterThan(pulseDescriptionIndex);
    expect(stripped).toContain(
      SECTION_COPY.en["deals-and-movements"].description,
    );
    expect(stripped).not.toContain("Competitive Landscape");
    expect(stripped).not.toContain(
      SECTION_COPY.en["competitive-landscape"].description,
    );
    expect(stripped).not.toContain("Quick Hits");
  });

  it.each(["en", "id"] as const)(
    "keeps every %s section description short enough for one line under its heading",
    (language) => {
      const lengths = Object.values(SECTION_COPY[language]).map(
        (copy) => copy.description.length,
      );

      expect(lengths).toHaveLength(NEWSLETTER_SECTION_KEYS.length);
      expect(Math.max(...lengths)).toBeLessThanOrEqual(75);
      expect(Math.min(...lengths)).toBeGreaterThanOrEqual(30);
    },
  );

  it("keeps every preview summary point within the 100-character cap", () => {
    // Setup
    const document = readNewsletterDocument(NEWSLETTER_PREVIEW_PROPS.bodyText);
    const points =
      document?.sections.flatMap((section) =>
        section.articles.flatMap((article) => article.points),
      ) ?? [];
    const overLimit = points.filter((point) => point.length > MAX_POINT_LENGTH);

    // Assert
    expect(document).toBeDefined();
    expect(points.length).toBeGreaterThan(0);
    expect(overLimit).toEqual([]);
  });

  it("caps each preview article at three summary points", () => {
    // Setup
    const document = readNewsletterDocument(NEWSLETTER_PREVIEW_PROPS.bodyText);
    const counts =
      document?.sections.flatMap((section) =>
        section.articles.map((article) => article.points.length),
      ) ?? [];

    // Assert
    expect(counts.length).toBeGreaterThan(0);
    expect(Math.max(...counts)).toBeLessThanOrEqual(MAX_POINTS_PER_ARTICLE);
  });

  it("keeps a dark-mode marker class on every element that carries a color", async () => {
    // Setup
    const industryBody = buildDocumentBody([
      {
        key: "industry-pulse",
        articles: [
          {
            title: "Repairing rather than roaring",
            author: "Jane Doe",
            source: "Market Wire",
            url: "https://example.com/pulse",
            points: ["A point with an [inline link](https://example.com/x)."],
          },
          {
            title: "A second article, so a divider renders",
            url: "https://example.com/second",
            points: ["Another point."],
          },
        ],
      },
    ]);

    // Act
    const { html } = await renderNewsletterEmail({
      title: "TLKM industry briefing",
      bodyText: industryBody,
      tickerSymbol: "TLKM",
      unsubscribeUrl: "https://example.com/unsubscribe",
    });

    // Assert
    const classNames = [...html.matchAll(/class="([^"]*)"/g)].flatMap((match) =>
      (match[1] ?? "").split(" "),
    );

    expect(html).toContain("@media (prefers-color-scheme:dark)");
    expect(html).toContain('name="color-scheme"');
    expect(classNames).toContain("e-canvas");
    expect(classNames).toContain("email-card");
    expect(classNames).toContain("e-ink");
    expect(classNames).toContain("e-body");
    expect(classNames).toContain("e-muted");
    expect(classNames).toContain("e-faint");
    expect(classNames).toContain("e-link");
    expect(classNames).toContain("e-rule");
    expect(classNames).toContain("e-rule-strong");
  });

  it("falls back to plain text and omits section descriptions when the document is invalid", async () => {
    // Setup: four points per article exceeds the schema cap, so the body is not a document.
    const invalidBody = JSON.stringify({
      version: 1,
      sections: [
        {
          key: "competitive-landscape",
          articles: [
            {
              title: "Nothing this week",
              url: "https://example.com/nothing",
              points: ["One.", "Two.", "Three.", "Four."],
            },
          ],
        },
      ],
    });

    // Act
    const { html } = await renderNewsletterEmail({
      title: "TLKM industry briefing",
      bodyText: invalidBody,
      tickerSymbol: "TLKM",
    });

    // Assert
    expect(html).not.toContain(
      SECTION_COPY.en["competitive-landscape"].description,
    );
    expect(html).toMatch(/<h1[^>]*>[^<]*TLKM industry briefing/i);
  });

  it("uses the Indonesian read-more label for industry documents when language is id", async () => {
    // Setup
    const industryBody = buildDocumentBody([
      {
        key: "industry-pulse",
        articles: [
          {
            title: "Sorotan pekan ini",
            url: "https://example.com/sorotan",
            points: ["Pasar bergerak mendatar pekan ini."],
          },
        ],
      },
    ]);

    // Act
    const { html } = await renderNewsletterEmail({
      title: "Buletin TLKM",
      bodyText: industryBody,
      tickerSymbol: "TLKM",
      language: "id",
    });

    // Assert
    const stripped = html.replace(/<!-- -->/g, "");

    expect(stripped).toContain("Baca artikel selengkapnya");
    expect(stripped).toContain(SECTION_COPY.id["industry-pulse"].label);
    expect(stripped).toContain(SECTION_COPY.id["industry-pulse"].description);
    expect(stripped).not.toContain("Read the full article");
  });

  it("renders the footer chrome in Indonesian when language is id", async () => {
    const { html, text } = await renderNewsletterEmail({
      title: "Buletin TLKM",
      bodyText: "Isi buletin",
      tickerSymbol: "TLKM",
      unsubscribeUrl: "https://app.example.com/api/unsubscribe?token=abc",
      language: "id",
    });

    expect(html).toContain("Dipersembahkan oleh");
    expect(html).toContain(", produk dari");
    expect(html).toContain(
      "Punya masukan? Balas email ini dan kami akan menggunakannya untuk meningkatkan buletin.",
    );
    expect(html).toContain(
      "Anda menerima email ini karena Anda berlangganan pembaruan TLKM.",
    );
    expect(html).toMatch(/Berhenti berlangganan pembaruan.*TLKM/i);
    expect(text).toContain(
      "Anda menerima email ini karena Anda berlangganan pembaruan TLKM.",
    );
    // English chrome must not leak into an Indonesian render.
    expect(html).not.toContain("Brought to you by");
    expect(html).not.toMatch(/reply to this email/i);
  });

  it("uses the Indonesian generic copy and fallback unsubscribe noun when tickerSymbol is omitted", async () => {
    const { html } = await renderNewsletterEmail({
      title: "Buletin",
      bodyText: "Isi buletin",
      unsubscribeUrl: "https://app.example.com/api/unsubscribe?token=abc",
      language: "id",
    });

    expect(html).toContain(
      "Anda menerima email ini karena Anda berlangganan pembaruan.",
    );
    expect(html).toMatch(/Berhenti berlangganan pembaruan.*ini/i);
  });

  it("keeps the footer chrome in English when language is omitted", async () => {
    const { html } = await renderNewsletterEmail({
      title: "Morning Briefing",
      bodyText: "Body content",
      tickerSymbol: "TLKM",
    });

    expect(html).toContain("Brought to you by");
    expect(html).toMatch(/reply to this email/i);
    expect(html).not.toContain("Dipersembahkan oleh");
  });
});
