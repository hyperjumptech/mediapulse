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
import type { CSSProperties, ReactElement } from "react";

import { parseNewsletterBody } from "./parse-newsletter-body.js";
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
   * Ticker symbol shown directly under the heading (e.g. "AAPL") and reused in
   * the unsubscribe link text. Falls back to "these" in the unsubscribe link
   * when omitted, and the ticker line above the body is hidden entirely.
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
export const DEFAULT_MEDIAPULSE_SITE_URL = "https://mediapulse.id";

/** Default Hyperjump marketing site link used for previews and when Hermes config omits the URL. */
export const DEFAULT_HYPERJUMP_SITE_URL = "https://hyperjump.tech";

/**
 * Default HTML newsletter layout for Mediapulse delivery.
 *
 * When `bodyText` follows the structured format (EXECUTIVE SUMMARY / --- / TOP N NEWS),
 * the content is rendered as labelled sections with visually separated news items.
 * Otherwise it falls back to pre-wrapped plain-text rendering.
 *
 * The header includes a short ticker line under the title when `tickerSymbol`
 * is set, and the footer carries a Mediapulse / Hyperjump branding block
 * directly above the subscription disclaimer.
 *
 * @param props.title - Heading text in the body.
 * @param props.bodyText - Main content; structured plain text or free-form.
 * @param props.footerNote - Optional footer copy.
 * @param props.unsubscribeUrl - Optional URL for the one-click unsubscribe link.
 * @param props.tickerSymbol - Ticker symbol shown under the title and in the unsubscribe link.
 * @param props.mediapulseSiteUrl - HTTPS URL for the Mediapulse footer link.
 * @param props.hyperjumpSiteUrl - HTTPS URL for the Hyperjump footer link.
 * @returns React Email document tree.
 */
export const DefaultNewsletterEmail = ({
  title,
  bodyText,
  footerNote = "You are receiving this because you subscribed to updates.",
  unsubscribeUrl,
  tickerSymbol,
  mediapulseSiteUrl = DEFAULT_MEDIAPULSE_SITE_URL,
  hyperjumpSiteUrl = DEFAULT_HYPERJUMP_SITE_URL,
}: DefaultNewsletterEmailProps): ReactElement => {
  const parsed = parseNewsletterBody(bodyText);
  const showTickerLine =
    tickerSymbol !== undefined && tickerSymbol.trim().length > 0;

  return (
    <Html>
      <Head />
      <Preview>{title}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Heading style={heading}>{title}</Heading>
            {showTickerLine ? (
              <Text style={tickerLine}>
                This digest covers <strong>{tickerSymbol}</strong>.
              </Text>
            ) : null}
          </Section>
          <Hr style={hr} />
          {parsed !== undefined ? (
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
                (item: (typeof parsed.topNewsItems)[number], index: number) => (
                  <Section key={item.number}>
                    <Text style={newsItemTitle}>
                      {item.number}. {item.title}
                    </Text>
                    <Text style={newsItemSummary}>
                      {renderInlineMarkdownLinks(item.summary, link)}
                    </Text>
                    {index < parsed.topNewsItems.length - 1 ? (
                      <Hr style={itemSeparator} />
                    ) : null}
                  </Section>
                ),
              )}
            </>
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
          <Text style={footer}>{footerNote}</Text>
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
    "",
    "2. Apple beats estimates",
    "Apple reported record quarterly revenue of $95B, driven by strong iPhone and services growth.",
    "",
    "3. Oil prices dip",
    "Crude oil fell 2% amid easing geopolitical tensions and rising US production.",
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

const itemSeparator: CSSProperties = {
  borderColor: "#e6ebf1",
  margin: "16px 0",
};

const tickerLine: CSSProperties = {
  color: "#4b5563",
  fontSize: "14px",
  lineHeight: "1.5",
  margin: "8px 0 0",
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
