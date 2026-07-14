import { Heading, Hr, Link, Section, Text } from "@react-email/components";
import { Fragment, type ReactElement } from "react";

import { parseNewsletterBody } from "./parse-newsletter-body.js";
import type { ParsedIndustrySection } from "./parse-industry-newsletter-wire.js";
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
   * Newsletter body as plain text with optional inline markdown links `[label](https://…)`
   * in section copy; structured bodies also use EXECUTIVE SUMMARY / TOP N NEWS markers.
   * Inline https links are rendered as clickable anchors (see {@link renderInlineMarkdownLinks}).
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

/** Canonical section labels keyed by wire `machineKey`. */
const SECTION_LABELS: Partial<
  Record<ParsedIndustrySection["machineKey"], string>
> = {
  "industry-pulse": "Industry Pulse",
  "competitive-landscape": "Competitive Landscape",
  "deals-and-movements": "Deals & Movements",
  "regulatory-policy-watch": "Regulatory & Policy Watch",
  "disruptors-or-tech": "Disruptors & Tech",
  "quick-hits": "Quick Hits",
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
        ? `You are receiving this because you subscribed to ${ticker} updates.`
        : "You are receiving this because you subscribed to updates.",
    unsubscribeLabel: (tickerOrFallback) =>
      `Unsubscribe from ${tickerOrFallback} updates`,
    unsubscribeFallback: "these",
  },
  id: {
    feedback:
      "Punya masukan? Balas email ini dan kami akan menggunakannya untuk meningkatkan buletin.",
    subscriptionNote: (ticker) =>
      ticker.length > 0
        ? `Anda menerima email ini karena Anda berlangganan pembaruan ${ticker}.`
        : "Anda menerima email ini karena Anda berlangganan pembaruan.",
    unsubscribeLabel: (tickerOrFallback) =>
      `Berhenti berlangganan pembaruan ${tickerOrFallback}`,
    unsubscribeFallback: "ini",
  },
};

/**
 * Splits a section display heading into an eyebrow label and subtitle.
 *
 * @param machineKey - Wire section key.
 * @param displayHeading - Model-provided heading text.
 * @returns Eyebrow and subtitle parts for rendering.
 */
export const decomposeSectionHeading = (
  machineKey: ParsedIndustrySection["machineKey"],
  displayHeading: string,
): { eyebrow: string | null; subtitle: string | null } => {
  const label = SECTION_LABELS[machineKey];
  if (label === undefined) {
    return { eyebrow: null, subtitle: displayHeading };
  }

  // Strip "Label / " prefix if the model included it (backward compat with old wire data)
  const prefix = `${label} / `;
  if (displayHeading.toLowerCase().startsWith(prefix.toLowerCase())) {
    const subtitle = displayHeading.slice(prefix.length).trim();
    return { eyebrow: label, subtitle: subtitle.length > 0 ? subtitle : null };
  }

  // When the heading is just the label itself, render it once instead of
  // repeating it as both eyebrow and subtitle.
  if (displayHeading.trim().toLowerCase() === label.toLowerCase()) {
    return { eyebrow: label, subtitle: null };
  }

  return { eyebrow: label, subtitle: displayHeading };
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
 * Renders a section header as an eyebrow kicker plus subtitle, or a plain label.
 *
 * @param machineKey - Wire section key.
 * @param displayHeading - Model-provided heading text.
 * @returns React Email heading elements for the section.
 */
export const renderSectionHeader = (
  machineKey: ParsedIndustrySection["machineKey"],
  displayHeading: string,
): ReactElement => {
  const { eyebrow, subtitle } = decomposeSectionHeading(
    machineKey,
    displayHeading,
  );
  const label = SECTION_LABELS[machineKey] ?? displayHeading;

  if (subtitle === null) {
    return (
      <Heading
        as="h2"
        className="m-0 mb-3 text-lg font-semibold leading-tight text-ink"
      >
        {label}
      </Heading>
    );
  }

  return (
    <>
      <Text className="m-0 mb-1 text-xs font-semibold uppercase leading-snug tracking-[0.06em] text-muted">
        {eyebrow ?? label}
      </Text>
      <Heading
        as="h2"
        className="m-0 mb-3 text-lg font-semibold leading-tight text-ink"
      >
        {subtitle}
      </Heading>
    </>
  );
};

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
 * When `bodyText` follows a structured format (legacy executive summary + top news,
 * or `MP_NEWSLETTER` industry briefing wire), the content is rendered as labelled
 * sections with separated items.
 * Otherwise it falls back to pre-wrapped plain-text rendering.
 *
 * Industry briefings render the Industry Pulse prose as a lead standfirst under the
 * title. The footer carries a Mediapulse / Hyperjump branding block directly above
 * the subscription disclaimer.
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
  const parsed = parseNewsletterBody(bodyText);
  const copy = FOOTER_COPY[language];
  const resolvedFooterNote =
    footerNote ?? buildDefaultFooterNote(tickerSymbol, language);
  const unsubscribeTarget = tickerSymbol ?? copy.unsubscribeFallback;

  const renderIndustrySection = (
    section: ParsedIndustrySection,
    index: number,
  ): ReactElement => {
    if (
      section.machineKey === "disruptors-or-tech" &&
      "format" in section &&
      section.format === "prose"
    ) {
      return (
        <Section key={`${section.machineKey}-${String(index)}`}>
          {renderSectionHeader(section.machineKey, section.displayHeading)}
          <Text className="m-0 whitespace-pre-wrap text-base leading-relaxed text-body">
            {renderInlineMarkdownLinks(section.prose, link)}
          </Text>
        </Section>
      );
    }

    if ("bullets" in section) {
      if (section.bullets.length === 0) {
        return <Fragment key={`${section.machineKey}-${String(index)}`} />;
      }
      return (
        <Section key={`${section.machineKey}-${String(index)}`}>
          {renderSectionHeader(section.machineKey, section.displayHeading)}
          {section.bullets.map((bullet, bulletIndex) => {
            const bulletCtaLabel = bullet.title ?? bullet.text;
            const bulletByline = formatArticleByline(bullet);
            return (
              <Section
                key={`${String(section.machineKey)}-b-${String(bulletIndex)}`}
              >
                {bulletByline !== undefined ? (
                  <Text className="m-0 mb-1 text-xs font-normal leading-normal text-muted">
                    {bulletByline}
                  </Text>
                ) : null}
                <Text className="m-0 text-base leading-relaxed text-body">
                  {renderInlineMarkdownLinks(bullet.text, link)}
                </Text>
                {bullet.url !== undefined && bullet.url !== "" ? (
                  <Text className="m-0 mt-2 text-sm leading-normal text-body">
                    <Link href={bullet.url} className={emailLinkClassName}>
                      Read: {bulletCtaLabel}
                    </Link>
                  </Text>
                ) : null}
                {bulletIndex < section.bullets.length - 1 ? (
                  <Hr className="my-4 border-0 border-t border-rule" />
                ) : null}
              </Section>
            );
          })}
        </Section>
      );
    }

    if (section.machineKey === "quick-hits") {
      if (section.items.length === 0) {
        return <Fragment key={`${section.machineKey}-${String(index)}`} />;
      }
      return (
        <Section key={`${section.machineKey}-${String(index)}`}>
          {renderSectionHeader(section.machineKey, section.displayHeading)}
          {section.items.map((item, itemIndex) => {
            const itemCtaLabel = item.title ?? item.text;
            const itemByline = formatArticleByline(item);
            return (
              <Section key={`qh-${String(itemIndex)}`}>
                {itemByline !== undefined ? (
                  <Text className="m-0 mb-1 text-xs font-normal leading-normal text-muted">
                    {itemByline}
                  </Text>
                ) : null}
                <Text className="m-0 text-base leading-relaxed text-body">
                  {renderInlineMarkdownLinks(item.text, link)}
                </Text>
                {item.url !== undefined && item.url !== "" ? (
                  <Text className="m-0 mt-2 text-sm leading-normal text-body">
                    <Link href={item.url} className={emailLinkClassName}>
                      Read: {itemCtaLabel}
                    </Link>
                  </Text>
                ) : null}
                {itemIndex < section.items.length - 1 ? (
                  <Hr className="my-4 border-0 border-t border-rule" />
                ) : null}
              </Section>
            );
          })}
        </Section>
      );
    }

    return <Fragment key={`unknown-${String(index)}`} />;
  };

  const industryPulseSection =
    parsed?.format === "industry"
      ? parsed.sections.find(
          (section) => section.machineKey === "industry-pulse",
        )
      : undefined;
  const leadCtaLabel =
    industryPulseSection?.machineKey === "industry-pulse"
      ? (industryPulseSection.title ?? industryPulseSection.displayHeading)
      : undefined;
  const industryBodySections =
    parsed?.format === "industry"
      ? parsed.sections.filter(
          (section) => section.machineKey !== "industry-pulse",
        )
      : [];

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
      <Section>
        <EmailHeading>{title}</EmailHeading>
        {industryPulseSection !== undefined ? (
          <>
            {(() => {
              const leadByline = formatArticleByline(industryPulseSection);
              return leadByline !== undefined ? (
                <Text className="m-0 mb-1 text-xs font-normal leading-normal text-muted">
                  {leadByline}
                </Text>
              ) : null;
            })()}
            <Text className="m-0 whitespace-pre-wrap text-[17px] leading-relaxed text-body">
              {renderInlineMarkdownLinks(industryPulseSection.prose, link)}
            </Text>
            {industryPulseSection.url !== undefined ? (
              <Text className="m-0 mt-2 text-sm leading-normal text-body">
                <Link
                  href={industryPulseSection.url}
                  className={emailLinkClassName}
                >
                  Read: {leadCtaLabel}
                </Link>
              </Text>
            ) : null}
          </>
        ) : null}
      </Section>
      <Hr className="my-6 border-0 border-t border-rule" />
      {parsed !== undefined ? (
        parsed.format === "industry" ? (
          <>
            {industryBodySections.map((section, index) => (
              <Fragment key={`sec-${String(index)}`}>
                {index > 0 ? (
                  <Hr className="my-6 border-0 border-t border-rule" />
                ) : null}
                {renderIndustrySection(section, index)}
              </Fragment>
            ))}
          </>
        ) : (
          <>
            <Heading
              as="h2"
              className="m-0 mb-3 text-lg font-semibold leading-tight text-ink"
            >
              Executive Summary
            </Heading>
            <Text className="m-0 whitespace-pre-wrap text-base leading-relaxed text-body">
              {renderInlineMarkdownLinks(parsed.executiveSummary, link)}
            </Text>
            <Hr className="my-6 border-0 border-t border-rule" />
            <Heading
              as="h2"
              className="m-0 mb-3 text-lg font-semibold leading-tight text-ink"
            >
              Top News
            </Heading>
            {parsed.topNewsItems.map(
              (item: (typeof parsed.topNewsItems)[number], index: number) => (
                <Section key={item.number}>
                  <Text className="m-0 mb-2 text-base font-semibold leading-normal text-body">
                    {item.number}. {item.title}
                  </Text>
                  <Text className="m-0 text-base leading-relaxed text-body">
                    {renderInlineMarkdownLinks(item.summary, link)}
                  </Text>
                  {item.url !== undefined && item.url !== "" ? (
                    <Text className="m-0 mt-2 text-sm leading-normal text-body">
                      <Link href={item.url} className={emailLinkClassName}>
                        Read: {item.title}
                      </Link>
                    </Text>
                  ) : null}
                  {index < parsed.topNewsItems.length - 1 ? (
                    <Hr className="my-4 border-0 border-t border-rule" />
                  ) : null}
                </Section>
              ),
            )}
          </>
        )
      ) : (
        <Text className="m-0 whitespace-pre-wrap text-base leading-relaxed text-body">
          {renderInlineMarkdownLinks(bodyText, link)}
        </Text>
      )}
    </EmailShell>
  );
};

/** Shared sample props for the preview wrappers (English base; id flips `language`). */
export const NEWSLETTER_PREVIEW_PROPS = {
  title: "ACME Weekly: Fixed broadband steadies the sector",
  bodyText: [
    "MP_NEWSLETTER",
    "",
    "BEGIN industry-pulse",
    "DISPLAY_HEADING",
    "The sector repairs, quietly",
    "SOURCE Market Wire",
    "PROSE",
    "The telecom sector is repairing rather than roaring. Fixed broadband net adds are carrying revenue growth while prepaid ARPU stays flat, and operators are leaning on bundling and home fiber to defend margins into the second half.",
    "Read the full article: https://example.com/sector/broadband-outlook",
    "END",
    "",
    "BEGIN competitive-landscape",
    "DISPLAY_HEADING",
    "Competitive Landscape / Fiber is the new battleground",
    "BULLET",
    "TITLE Acme extends home-fiber lead",
    "AUTHOR Jane Doe",
    "SOURCE Market Wire",
    "Acme Telecom added roughly 320,000 home-fiber subscribers in the quarter, widening its lead as rivals struggle to match its backbone reach in secondary cities.",
    "Read the full article: https://example.com/acme/home-fiber",
    "BULLET",
    "TITLE Contoso Mobile leans on convergence",
    "Contoso Mobile pushed converged mobile-plus-home plans to lift retention, trading near-term ARPU for lower churn in contested urban clusters.",
    "Read the full article: https://example.com/contoso/convergence",
    "END",
    "",
    "BEGIN deals-and-movements",
    "DISPLAY_HEADING",
    "Deals & Movements",
    "BULLET",
    "TITLE Northwind closes tower acquisition",
    "Northwind Towers completed the purchase of about 2,800 sites, building the largest independent tower portfolio in the region.",
    "Read the full article: https://example.com/northwind/tower-deal",
    "END",
    "",
    "BEGIN regulatory-policy-watch",
    "DISPLAY_HEADING",
    "Regulatory & Policy Watch / Spectrum on the agenda",
    "BULLET",
    "The regulator signaled a mid-band spectrum auction for next year, a prerequisite for wider 5G coverage beyond the largest cities.",
    "Read the full article: https://example.com/policy/spectrum-auction",
    "END",
    "",
    "BEGIN disruptors-or-tech",
    "DISPLAY_HEADING",
    "Disruptors & Tech / AI moves to the edge",
    "FORMAT",
    "prose",
    "PROSE",
    "Operators are piloting AI-driven network optimization to squeeze more capacity from existing sites, while fixed-wireless access is emerging as a cheaper path to homes that fiber has not yet reached.",
    "END",
    "",
    "BEGIN quick-hits",
    "DISPLAY_HEADING",
    "Quick Hits",
    "ITEM",
    "Acme reaffirmed its full-year capex guidance.",
    "ITEM",
    "Contoso Mobile reported steady data traffic growth.",
    "Read the full article: https://example.com/contoso/data-traffic",
    "ITEM",
    "Fabrikam expanded prepaid promotions ahead of the holiday quarter.",
    "ITEM",
    "A new submarine cable landing was approved in the east.",
    "ITEM",
    "The board reaffirmed its dividend timeline for the year.",
    "END",
  ].join("\n"),
  unsubscribeUrl: "https://example.com/api/unsubscribe?token=preview",
  tickerSymbol: "ACME",
  mediapulseSiteUrl: DEFAULT_MEDIAPULSE_SITE_URL,
  hyperjumpSiteUrl: DEFAULT_HYPERJUMP_SITE_URL,
} satisfies DefaultNewsletterEmailProps;
