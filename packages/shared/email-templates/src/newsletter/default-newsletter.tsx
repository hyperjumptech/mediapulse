import { Heading, Hr, Link, Section, Text } from "@react-email/components";
import { Fragment, type ReactElement } from "react";

import { parseNewsletterBody } from "./parse-newsletter-body.js";
import type {
  NewsletterArticle,
  NewsletterSection,
  NewsletterSectionKey,
} from "./newsletter-document.js";
import { renderInlineMarkdownLinks } from "./render-inline-markdown-links.js";
import {
  DEFAULT_HYPERJUMP_SITE_URL,
  DEFAULT_MEDIAPULSE_SITE_URL,
  EmailHeading,
  EmailShell,
  emailLink as link,
  emailLinkClassName,
  type EmailLanguage,
} from "../shared/email-shell.js";
export interface DefaultNewsletterEmailProps {
  /** Shown as the main title inside the email body (typically matches the message subject). */
  title: string;
  /**
   * Newsletter body. A JSON newsletter document renders as structured sections; anything
   * else renders as plain text with inline markdown links `[label](https://…)` turned into
   * anchors (see {@link renderInlineMarkdownLinks}).
   */
  bodyText: string;
  /** Optional footer line (e.g. unsubscribe placeholder). */
  footerNote?: string;
  /**
   * Absolute HTTPS URL for the one-click unsubscribe endpoint;
   * when omitted, the unsubscribe link is hidden.
   */
  unsubscribeUrl?: string;
  /**
   * Ticker symbol reused in the subscription footer and unsubscribe link text.
   * Falls back to "these" in the unsubscribe link when omitted.
   */
  tickerSymbol?: string;
  /**
   * Absolute HTTPS URL for the Mediapulse marketing site, used in the footer
   * branding section. Defaults to the public Mediapulse site so previews and
   * standalone renders stay correct; delivery passes operator-configured
   * values from Hermes when available.
   */
  mediapulseSiteUrl?: string;
  /**
   * Absolute HTTPS URL for the Hyperjump marketing site, used in the footer
   * branding section. Defaults to the public Hyperjump site so previews and
   * standalone renders stay correct; delivery passes operator-configured
   * values from Hermes when available.
   */
  hyperjumpSiteUrl?: string;
  /**
   * Footer chrome language. The newsletter body is translated upstream
   * (NewsletterTranslation); this only localizes the static footer strings
   * (branding line, feedback line, subscription note, unsubscribe label).
   * Defaults to "en".
   */
  language?: FooterLanguage;
}

export {
  DEFAULT_MEDIAPULSE_SITE_URL,
  DEFAULT_HYPERJUMP_SITE_URL,
} from "../shared/email-shell.js";

/** Reader-facing name and remit of one newsletter section. */
interface SectionCopy {
  /** Canonical section label rendered as the section heading. */
  label: string;
  /** Plain-language explanation of what the section collects. */
  description: string;
}

/**
 * Section labels and descriptions keyed by language, then by section key.
 *
 * The section names are Mediapulse vocabulary, so each one states which kinds of
 * stories it collects rather than assuming the reader already knows the term.
 * Descriptions are capped so each one fits on a single line under its heading.
 */
export const SECTION_COPY: Record<
  FooterLanguage,
  Record<NewsletterSectionKey, SectionCopy>
> = {
  en: {
    "industry-pulse": {
      label: "Industry Pulse",
      description: "The stories moving the whole sector right now.",
    },
    "issuer-performance": {
      label: "Issuer Performance",
      description: "The numbers the company itself just reported.",
    },
    "issuer-news": {
      label: "Issuer News",
      description: "What is happening to the company beyond its results.",
    },
    "competitive-landscape": {
      label: "Competitive Landscape",
      description: "The rivals gaining ground, and the ones falling behind.",
    },
    "deals-and-movements": {
      label: "Deals & Movements",
      description:
        "The deals, funding, and leadership changes reshaping companies.",
    },
    "regulatory-policy-watch": {
      label: "Regulatory & Policy Watch",
      description: "The rules and decisions changing what companies can do.",
    },
    "disruptors-or-tech": {
      label: "Disruptors & Tech",
      description:
        "The technology and new entrants changing how the sector works.",
    },
    "quick-hits": {
      label: "Quick Hits",
      description: "The smaller stories still worth knowing.",
    },
  },
  id: {
    "industry-pulse": {
      label: "Sorotan Industri",
      description: "Berita yang sedang menggerakkan seluruh industri.",
    },
    "issuer-performance": {
      label: "Kinerja Emiten",
      description: "Angka yang baru saja dilaporkan perusahaan itu sendiri.",
    },
    "issuer-news": {
      label: "Kabar Emiten",
      description:
        "Hal yang terjadi pada perusahaan di luar laporan kinerjanya.",
    },
    "competitive-landscape": {
      label: "Peta Persaingan",
      description: "Pesaing yang sedang unggul, dan yang mulai tertinggal.",
    },
    "deals-and-movements": {
      label: "Aksi Korporasi",
      description:
        "Transaksi dan pergantian pemimpin yang menggerakkan perusahaan.",
    },
    "regulatory-policy-watch": {
      label: "Pantauan Regulasi",
      description: "Aturan dan keputusan yang mengubah ruang gerak perusahaan.",
    },
    "disruptors-or-tech": {
      label: "Disrupsi & Teknologi",
      description:
        "Teknologi dan pemain baru yang mengubah cara kerja industri.",
    },
    "quick-hits": {
      label: "Sekilas Info",
      description: "Berita kecil yang tetap perlu diketahui.",
    },
  },
};

/**
 * Label for an article's source link, keyed by language.
 *
 * Deliberately generic: the article title is rendered directly above the link, so
 * repeating it in the link text would print the same words twice.
 *
 * - Important: reads the same as content-generation's `READ_FULL_ARTICLE_LABEL`, the wire-format
 *   marker the parser strips before rendering. A leaked marker is still detectable because it
 *   always carries its `: <url>` tail, which this label never does.
 */
const ARTICLE_LINK_LABEL: Record<FooterLanguage, string> = {
  en: "Read the full article…",
  id: "Baca artikel selengkapnya…",
};

/** Newsletter footer language. Alias of the shared {@link EmailLanguage}. */
export type FooterLanguage = EmailLanguage;

/** Newsletter-specific footer strings for one language (branding lives in the shell). */
interface FooterCopy {
  /** Reply-for-feedback line. */
  feedback: string;
  /** Subscription disclaimer, given a trimmed ticker symbol (empty when unknown). */
  subscriptionNote: (ticker: string) => string;
  /** Unsubscribe link label, given the resolved ticker or fallback noun. */
  unsubscribeLabel: (tickerOrFallback: string) => string;
  /** Noun used in the unsubscribe label when no ticker symbol is available. */
  unsubscribeFallback: string;
}

/** Newsletter footer copy keyed by language. */
const FOOTER_COPY: Record<FooterLanguage, FooterCopy> = {
  en: {
    feedback:
      "Have feedback? Reply to this email and we will use it to improve the newsletter.",
    subscriptionNote: (ticker) =>
      ticker.length > 0
        ? `You are receiving this because you subscribed to ${ticker} updates. We send an issue only when ${ticker} has news worth reading, so some days there is no email.`
        : "You are receiving this because you subscribed to updates. We send an issue only when there is news worth reading, so some days there is no email.",
    unsubscribeLabel: (tickerOrFallback) =>
      `Unsubscribe from ${tickerOrFallback} updates`,
    unsubscribeFallback: "these",
  },
  id: {
    feedback:
      "Punya masukan? Balas email ini dan kami akan menggunakannya untuk meningkatkan buletin.",
    subscriptionNote: (ticker) =>
      ticker.length > 0
        ? `Anda menerima email ini karena Anda berlangganan pembaruan ${ticker}. Kami mengirim edisi hanya saat ada berita ${ticker} yang layak dibaca, jadi ada hari tanpa email.`
        : "Anda menerima email ini karena Anda berlangganan pembaruan. Kami mengirim edisi hanya saat ada berita yang layak dibaca, jadi ada hari tanpa email.",
    unsubscribeLabel: (tickerOrFallback) =>
      `Berhenti berlangganan pembaruan ${tickerOrFallback}`,
    unsubscribeFallback: "ini",
  },
};

/**
 * Builds the byline line shown above an article.
 *
 * @param byline - Optional author and source for the article.
 * @returns `By {author} · {source}` when an author exists, the source alone when only the source exists, or `undefined`.
 */
export const formatArticleByline = (byline: {
  author?: string;
  source?: string;
}): string | undefined => {
  const author = byline.author?.trim() ?? "";
  const source = byline.source?.trim() ?? "";
  if (author.length > 0) {
    return source.length > 0 ? `By ${author} · ${source}` : `By ${author}`;
  }
  return source.length > 0 ? source : undefined;
};

/**
 * Renders a section header as the canonical section label.
 *
 * @param sectionKey - Canonical section key.
 * @param language - Language for the section label.
 * @returns React Email heading element for the section.
 */
export const renderSectionHeader = (
  sectionKey: NewsletterSectionKey,
  language: FooterLanguage = "en",
): ReactElement => {
  const copy = SECTION_COPY[language][sectionKey];

  return (
    <>
      <Heading
        as="h2"
        className="e-ink m-0 mb-1 text-xl font-bold leading-tight tracking-[-0.01em] text-ink"
      >
        {copy.label}
      </Heading>
      <Text className="e-faint e-rule-strong m-0 mb-5 border-0 border-b-2 border-solid border-ink pb-2 text-xs leading-normal text-faint">
        {copy.description}
      </Text>
    </>
  );
};

/**
 * Reports whether a parsed section has content worth rendering.
 *
 * @param section - Parsed wire section.
 * @returns `true` when the section renders at least one row or a non-empty prose block.
 */
export const hasRenderableContent = (section: NewsletterSection): boolean =>
  section.articles.some((article) => article.points.length > 0);

/**
 * Builds the default subscription footer when no explicit `footerNote` is passed.
 *
 * @param tickerSymbol - Optional ticker symbol for personalized copy.
 * @param language - Footer chrome language. Defaults to "en".
 * @returns Footer disclaimer text.
 */
export const buildDefaultFooterNote = (
  tickerSymbol?: string,
  language: FooterLanguage = "en",
): string => {
  const trimmed = tickerSymbol?.trim() ?? "";
  return FOOTER_COPY[language].subscriptionNote(trimmed);
};

/**
 * Default HTML newsletter layout for Mediapulse delivery.
 *
 * When `bodyText` is a valid newsletter document, it renders as labelled sections.
 * Otherwise it falls back to pre-wrapped plain-text rendering.
 *
 * Industry briefings omit the body title and render every section, Industry Pulse
 * included, as a block under its canonical section label, and close with a glossary
 * box defining those labels. The footer carries a
 * Mediapulse / Hyperjump branding block directly above the subscription disclaimer.
 *
 * @param props.title - Heading text in the body.
 * @param props.bodyText - Main content; structured plain text or free-form.
 * @param props.footerNote - Optional footer copy.
 * @param props.unsubscribeUrl - Optional URL for the one-click unsubscribe link.
 * @param props.tickerSymbol - Ticker symbol used in the footer and unsubscribe link.
 * @param props.mediapulseSiteUrl - HTTPS URL for the Mediapulse footer link.
 * @param props.hyperjumpSiteUrl - HTTPS URL for the Hyperjump footer link.
 * @returns React Email document tree.
 */
export const DefaultNewsletterEmail = ({
  title,
  bodyText,
  footerNote,
  unsubscribeUrl,
  tickerSymbol,
  mediapulseSiteUrl = DEFAULT_MEDIAPULSE_SITE_URL,
  hyperjumpSiteUrl = DEFAULT_HYPERJUMP_SITE_URL,
  language = "en",
}: DefaultNewsletterEmailProps): ReactElement => {
  const document = parseNewsletterBody(bodyText);
  const copy = FOOTER_COPY[language];
  const resolvedFooterNote =
    footerNote ?? buildDefaultFooterNote(tickerSymbol, language);
  const unsubscribeTarget = tickerSymbol ?? copy.unsubscribeFallback;

  const renderArticle = (
    article: NewsletterArticle,
    sectionKey: NewsletterSectionKey,
    articleIndex: number,
    isLast: boolean,
  ): ReactElement => {
    const byline = formatArticleByline(article);

    return (
      <Section key={`${sectionKey}-a-${String(articleIndex)}`}>
        <Text className="e-ink m-0 mb-1 text-[17px] font-semibold leading-snug text-ink">
          {article.title}
        </Text>
        {byline !== undefined ? (
          <Text className="e-faint m-0 mb-3 text-xs font-normal uppercase leading-normal tracking-[0.04em] text-faint">
            {byline}
          </Text>
        ) : null}
        <ul className="e-body m-0 mb-0 list-disc pl-5 text-[15px] leading-[1.65] text-body">
          {article.points.map((point, pointIndex) => (
            <li key={`p-${String(pointIndex)}`} className="mb-2 pl-1">
              {renderInlineMarkdownLinks(point, link, {
                linkClassName: emailLinkClassName,
              })}
            </li>
          ))}
        </ul>
        <Text className="m-0 mt-3 text-sm font-medium leading-normal">
          <Link href={article.url} className={emailLinkClassName}>
            {ARTICLE_LINK_LABEL[language]}
          </Link>
        </Text>
        {isLast ? null : (
          <Hr className="e-rule my-6 border-0 border-t border-rule" />
        )}
      </Section>
    );
  };

  const renderIndustrySection = (
    section: NewsletterSection,
    index: number,
  ): ReactElement => (
    <Section key={`${section.key}-${String(index)}`}>
      {renderSectionHeader(section.key, language)}
      {section.articles.map((article, articleIndex) =>
        renderArticle(
          article,
          section.key,
          articleIndex,
          articleIndex === section.articles.length - 1,
        ),
      )}
    </Section>
  );

  const isIndustryFormat = document !== undefined;
  const industryBodySections =
    document?.sections.filter(hasRenderableContent) ?? [];

  return (
    <EmailShell
      preview={title}
      language={language}
      mediapulseSiteUrl={mediapulseSiteUrl}
      hyperjumpSiteUrl={hyperjumpSiteUrl}
      footer={{
        feedback: copy.feedback,
        note: resolvedFooterNote,
        ...(unsubscribeUrl !== undefined && unsubscribeUrl !== ""
          ? {
              unsubscribe: {
                url: unsubscribeUrl,
                label: copy.unsubscribeLabel(unsubscribeTarget),
              },
            }
          : {}),
      }}
    >
      {isIndustryFormat ? null : (
        <>
          <Section>
            <EmailHeading>{title}</EmailHeading>
          </Section>
          <Hr className="e-rule my-6 border-0 border-t border-rule" />
        </>
      )}
      {document !== undefined ? (
        <>
          {industryBodySections.map((section, index) => (
            <Fragment key={`sec-${String(index)}`}>
              {index > 0 ? (
                <Hr className="e-rule my-6 border-0 border-t border-rule" />
              ) : null}
              {renderIndustrySection(section, index)}
            </Fragment>
          ))}
        </>
      ) : (
        <Text className="e-body m-0 whitespace-pre-wrap text-base leading-relaxed text-body">
          {renderInlineMarkdownLinks(bodyText, link, {
            linkClassName: emailLinkClassName,
          })}
        </Text>
      )}
    </EmailShell>
  );
};

/** Shared sample props for the preview wrappers (English base; id flips `language`). */
/** Shared sample props for the preview wrappers (English base; id flips `language`). */
export const NEWSLETTER_PREVIEW_PROPS = {
  title: "ACME Weekly: Fixed broadband steadies the sector",
  bodyText: JSON.stringify({
    version: 1,
    sections: [
      {
        key: "industry-pulse",
        articles: [
          {
            title: "Fixed broadband carries a flat quarter",
            author: "Jane Doe",
            source: "Market Wire",
            url: "https://example.com/sector/broadband-outlook",
            points: [
              "Fixed broadband net adds carried sector revenue growth for a third quarter.",
              "Prepaid ARPU stayed flat, leaving bundling as the main defence of margins.",
              "Operators guided to a second half that repairs rather than accelerates.",
            ],
          },
          {
            title: "Home fiber becomes the sector's growth engine",
            source: "Telecom Daily",
            url: "https://example.com/sector/fiber-growth-engine",
            points: [
              "Home fiber now drives most incremental revenue at the top four operators.",
              "Capex is shifting from mobile densification toward fiber backhaul.",
            ],
          },
        ],
      },
      {
        key: "competitive-landscape",
        articles: [
          {
            title: "Acme extends home-fiber lead",
            author: "Jane Doe",
            source: "Market Wire",
            url: "https://example.com/acme/home-fiber",
            points: [
              "Added roughly 320,000 home-fiber subscribers in the quarter.",
              "Widened its lead as rivals struggled to match backbone reach.",
              "Growth concentrated in secondary cities rather than the capital.",
            ],
          },
          {
            title: "Contoso Mobile leans on convergence",
            source: "Telecom Daily",
            url: "https://example.com/contoso/convergence",
            points: [
              "Pushed converged mobile-plus-home plans to lift retention.",
              "Traded near-term ARPU for lower churn in contested urban clusters.",
            ],
          },
        ],
      },
      {
        key: "deals-and-movements",
        articles: [
          {
            title: "Northwind closes tower acquisition",
            source: "Deal Register",
            url: "https://example.com/northwind/tower-deal",
            points: [
              "Completed the purchase of about 2,800 tower sites.",
              "Creates the largest independent tower portfolio in the region.",
              "Funded with a mix of new debt and an equity injection.",
            ],
          },
        ],
      },
      {
        key: "regulatory-policy-watch",
        articles: [
          {
            title: "Regulator signals mid-band spectrum auction",
            source: "Policy Brief",
            url: "https://example.com/policy/spectrum-auction",
            points: [
              "An auction was signalled for next year, the first since 2021.",
              "Mid-band spectrum is a prerequisite for 5G beyond the largest cities.",
            ],
          },
        ],
      },
      {
        key: "disruptors-or-tech",
        articles: [
          {
            title: "AI lands in network planning",
            source: "Market Wire",
            url: "https://example.com/tech/ai-network-planning",
            points: [
              "Operators are piloting AI-driven network optimization.",
              "Early results squeeze more capacity out of existing sites.",
              "No new spectrum is required to capture the gain.",
            ],
          },
          {
            title: "Fixed wireless fills the fiber gap",
            url: "https://example.com/tech/fixed-wireless-access",
            points: [
              "Fixed-wireless access is emerging as a cheaper path to unserved homes.",
              "Most attractive outside cities, where fiber payback is long.",
            ],
          },
        ],
      },
      {
        key: "quick-hits",
        articles: [
          {
            title: "Acme holds full-year capex guidance",
            source: "Market Wire",
            url: "https://example.com/acme/capex-guidance",
            points: [
              "Reaffirmed its full-year capex guidance at the earnings call.",
              "No change to the fiber build target for the year.",
            ],
          },
          {
            title: "Contoso data traffic keeps climbing",
            source: "Telecom Daily",
            url: "https://example.com/contoso/data-traffic",
            points: [
              "Reported steady double-digit data traffic growth.",
              "Growth is now led by fixed wireless rather than mobile.",
            ],
          },
          {
            title: "Fabrikam widens prepaid promotions",
            url: "https://example.com/fabrikam/prepaid-promotions",
            points: [
              "Expanded prepaid promotions ahead of the holiday quarter.",
              "Targets the price-sensitive segment rivals have been ceding.",
            ],
          },
        ],
      },
    ],
  }),
  unsubscribeUrl: "https://example.com/api/unsubscribe?token=preview",
  tickerSymbol: "ACME",
  mediapulseSiteUrl: DEFAULT_MEDIAPULSE_SITE_URL,
  hyperjumpSiteUrl: DEFAULT_HYPERJUMP_SITE_URL,
} satisfies DefaultNewsletterEmailProps;
