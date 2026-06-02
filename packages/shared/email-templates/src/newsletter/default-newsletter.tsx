import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import { Fragment, type CSSProperties, type ReactElement } from "react";

import { parseNewsletterBody } from "./parse-newsletter-body.js";
import type { ParsedIndustrySection } from "./parse-industry-newsletter-wire.js";
import { renderInlineMarkdownLinks } from "./render-inline-markdown-links.js";

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
}

/** Default Mediapulse marketing site link used for previews and when Hermes config omits the URL. */
export const DEFAULT_MEDIAPULSE_SITE_URL = "https://mediapulse.hyperjump.tech";

/** Default Hyperjump marketing site link used for previews and when Hermes config omits the URL. */
export const DEFAULT_HYPERJUMP_SITE_URL = "https://hyperjump.tech";

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

  return { eyebrow: label, subtitle: displayHeading };
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
      <Heading as="h2" style={sectionLabel}>
        {label}
      </Heading>
    );
  }

  return (
    <>
      <Text style={sectionEyebrow}>{eyebrow ?? label}</Text>
      <Heading as="h2" style={sectionLabel}>
        {subtitle}
      </Heading>
    </>
  );
};

/**
 * Builds the default subscription footer when no explicit `footerNote` is passed.
 *
 * @param tickerSymbol - Optional ticker symbol for personalized copy.
 * @returns Footer disclaimer text.
 */
export const buildDefaultFooterNote = (tickerSymbol?: string): string => {
  const trimmed = tickerSymbol?.trim() ?? "";
  if (trimmed.length > 0) {
    return `You are receiving this because you subscribed to ${trimmed} updates.`;
  }
  return "You are receiving this because you subscribed to updates.";
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
}: DefaultNewsletterEmailProps): ReactElement => {
  const parsed = parseNewsletterBody(bodyText);
  const resolvedFooterNote = footerNote ?? buildDefaultFooterNote(tickerSymbol);

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
          <Text style={bodyParagraph}>
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
          {section.bullets.map((bullet, bulletIndex) => (
            <Section
              key={`${String(section.machineKey)}-b-${String(bulletIndex)}`}
            >
              <Text style={newsItemSummary}>
                {renderInlineMarkdownLinks(bullet.text, link)}
              </Text>
              {bullet.url !== undefined && bullet.url !== "" ? (
                <Text style={newsItemSourceLink}>
                  <Link href={bullet.url} style={link}>
                    Read the full article
                  </Link>
                </Text>
              ) : null}
              {bulletIndex < section.bullets.length - 1 ? (
                <Hr style={itemSeparator} />
              ) : null}
            </Section>
          ))}
        </Section>
      );
    }

    if (section.machineKey === "quick-hits") {
      return (
        <Section key={`${section.machineKey}-${String(index)}`}>
          {renderSectionHeader(section.machineKey, section.displayHeading)}
          {section.items.map((item, itemIndex) => (
            <Section key={`qh-${String(itemIndex)}`}>
              <Text style={newsItemTitle}>
                {itemIndex + 1}. {item.text}
              </Text>
              {item.url !== undefined && item.url !== "" ? (
                <Text style={newsItemSourceLink}>
                  <Link href={item.url} style={link}>
                    Read the full article
                  </Link>
                </Text>
              ) : null}
              {itemIndex < section.items.length - 1 ? (
                <Hr style={itemSeparator} />
              ) : null}
            </Section>
          ))}
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
  const industryBodySections =
    parsed?.format === "industry"
      ? parsed.sections.filter(
          (section) => section.machineKey !== "industry-pulse",
        )
      : [];

  return (
    <Html>
      <Head />
      <Preview>{title}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Heading style={heading}>{title}</Heading>
            {industryPulseSection !== undefined ? (
              <Text style={standfirst}>
                {renderInlineMarkdownLinks(industryPulseSection.prose, link)}
              </Text>
            ) : null}
          </Section>
          <Hr style={hr} />
          {parsed !== undefined ? (
            parsed.format === "industry" ? (
              <>
                {industryBodySections.map((section, index) => (
                  <Fragment key={`sec-${String(index)}`}>
                    {index > 0 ? <Hr style={hr} /> : null}
                    {renderIndustrySection(section, index)}
                  </Fragment>
                ))}
              </>
            ) : (
              <>
                <Heading as="h2" style={sectionLabel}>
                  Executive Summary
                </Heading>
                <Text style={bodyParagraph}>
                  {renderInlineMarkdownLinks(parsed.executiveSummary, link)}
                </Text>
                <Hr style={hr} />
                <Heading as="h2" style={sectionLabel}>
                  Top News
                </Heading>
                {parsed.topNewsItems.map(
                  (
                    item: (typeof parsed.topNewsItems)[number],
                    index: number,
                  ) => (
                    <Section key={item.number}>
                      <Text style={newsItemTitle}>
                        {item.number}. {item.title}
                      </Text>
                      <Text style={newsItemSummary}>
                        {renderInlineMarkdownLinks(item.summary, link)}
                      </Text>
                      {item.url !== undefined && item.url !== "" ? (
                        <Text style={newsItemSourceLink}>
                          <Link href={item.url} style={link}>
                            Read the full article
                          </Link>
                        </Text>
                      ) : null}
                      {index < parsed.topNewsItems.length - 1 ? (
                        <Hr style={itemSeparator} />
                      ) : null}
                    </Section>
                  ),
                )}
              </>
            )
          ) : (
            <Text style={bodyParagraph}>
              {renderInlineMarkdownLinks(bodyText, link)}
            </Text>
          )}
          <Hr style={hr} />
          <Text style={brandingLine}>
            Brought to you by{" "}
            <Link href={mediapulseSiteUrl} style={link}>
              Mediapulse
            </Link>
            , a product of{" "}
            <Link href={hyperjumpSiteUrl} style={link}>
              Hyperjump
            </Link>
            .
          </Text>
          <Text style={footer}>{resolvedFooterNote}</Text>
          {unsubscribeUrl !== undefined && unsubscribeUrl !== "" ? (
            <Text style={footerMuted}>
              <Link href={unsubscribeUrl} style={link}>
                Unsubscribe from {tickerSymbol ?? "these"} updates
              </Link>
            </Text>
          ) : null}
        </Container>
      </Body>
    </Html>
  );
};

DefaultNewsletterEmail.PreviewProps = {
  title: "Weekly digest",
  bodyText: [
    "EXECUTIVE SUMMARY",
    "",
    "Markets rallied today as tech earnings exceeded expectations and the Fed signaled a measured approach to rate adjustments.",
    "",
    "---",
    "",
    "TOP 3 NEWS",
    "",
    "1. Fed holds rates steady",
    "The Federal Reserve announced no change to interest rates, citing stable inflation and strong employment data.",
    "Read the full article: https://example.com/fed-holds-rates",
    "",
    "2. Apple beats estimates",
    "Apple reported record quarterly revenue of $95B, driven by strong iPhone and services growth.",
    "Read the full article: https://example.com/apple-earnings",
    "",
    "3. Oil prices dip",
    "Crude oil fell 2% amid easing geopolitical tensions and rising US production.",
    "Read the full article: https://example.com/oil-prices",
  ].join("\n"),
  footerNote:
    "You can unsubscribe from ticker updates in your account settings.",
  unsubscribeUrl: "https://mediapulse.com/api/unsubscribe?token=example",
  tickerSymbol: "AAPL",
  mediapulseSiteUrl: DEFAULT_MEDIAPULSE_SITE_URL,
  hyperjumpSiteUrl: DEFAULT_HYPERJUMP_SITE_URL,
} satisfies DefaultNewsletterEmailProps;

export default DefaultNewsletterEmail;

const main: CSSProperties = {
  backgroundColor: "#f6f9fc",
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container: CSSProperties = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  padding: "24px 20px 32px",
  marginBottom: "32px",
  maxWidth: "600px",
};

const header: CSSProperties = {
  padding: "8px 0",
};

const heading: CSSProperties = {
  color: "#1a1a1a",
  fontSize: "24px",
  fontWeight: "600",
  lineHeight: "1.3",
  margin: "0",
};

const standfirst: CSSProperties = {
  color: "#374151",
  fontSize: "17px",
  lineHeight: "1.6",
  margin: "12px 0 0",
  whiteSpace: "pre-wrap",
};

const hr: CSSProperties = {
  borderColor: "#e6ebf1",
  margin: "20px 0",
};

const bodyParagraph: CSSProperties = {
  color: "#374151",
  fontSize: "16px",
  lineHeight: "1.6",
  margin: "0",
  whiteSpace: "pre-wrap",
};

const sectionEyebrow: CSSProperties = {
  color: "#6b7280",
  fontSize: "12px",
  fontWeight: "600",
  letterSpacing: "0.06em",
  lineHeight: "1.4",
  margin: "0 0 4px",
  textTransform: "uppercase",
};

const sectionLabel: CSSProperties = {
  color: "#1a1a1a",
  fontSize: "18px",
  fontWeight: "600",
  lineHeight: "1.3",
  margin: "0 0 12px",
};

const newsItemTitle: CSSProperties = {
  color: "#374151",
  fontSize: "16px",
  fontWeight: "600",
  lineHeight: "1.5",
  margin: "0 0 4px",
};

const newsItemSummary: CSSProperties = {
  color: "#374151",
  fontSize: "16px",
  lineHeight: "1.6",
  margin: "0",
};

const newsItemSourceLink: CSSProperties = {
  color: "#374151",
  fontSize: "14px",
  lineHeight: "1.5",
  margin: "8px 0 0",
};

const itemSeparator: CSSProperties = {
  borderColor: "#e6ebf1",
  margin: "16px 0",
};

const brandingLine: CSSProperties = {
  color: "#374151",
  fontSize: "13px",
  lineHeight: "1.5",
  margin: "0 0 12px",
};

const footer: CSSProperties = {
  color: "#6b7280",
  fontSize: "12px",
  lineHeight: "1.5",
  margin: "0 0 8px",
};

const footerMuted: CSSProperties = {
  color: "#9ca3af",
  fontSize: "12px",
  margin: "0",
};

const link: CSSProperties = {
  color: "#2563eb",
  textDecoration: "underline",
};
