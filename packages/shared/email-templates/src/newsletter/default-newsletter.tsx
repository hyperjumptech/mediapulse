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
import type { CSSProperties } from "react";

export interface DefaultNewsletterEmailProps {
  /** Shown as the main title inside the email body (typically matches the message subject). */
  title: string;
  /**
   * Newsletter body as plain text or minimal markdown-style lines.
   * Rendered as pre-wrapped text (no raw HTML injection).
   */
  bodyText: string;
  /** Optional footer line (e.g. unsubscribe placeholder). */
  footerNote?: string;
}

/**
 * Default HTML newsletter layout for Mediapulse delivery.
 *
 * @param props.title - Heading text in the body.
 * @param props.bodyText - Main content; treated as plain text with preserved line breaks.
 * @param props.footerNote - Optional footer copy.
 * @returns React Email document tree.
 */
export const DefaultNewsletterEmail = ({
  title,
  bodyText,
  footerNote = "You are receiving this because you subscribed to updates.",
}: DefaultNewsletterEmailProps): React.JSX.Element => {
  return (
    <Html>
      <Head />
      <Preview>{title}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Heading style={heading}>{title}</Heading>
          </Section>
          <Hr style={hr} />
          <Text style={bodyParagraph}>{bodyText}</Text>
          <Hr style={hr} />
          <Text style={footer}>{footerNote}</Text>
          <Text style={footerMuted}>
            <Link href="https://example.com/preferences" style={link}>
              Manage preferences
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

DefaultNewsletterEmail.PreviewProps = {
  title: "Weekly digest",
  bodyText: "Hello,\n\nHere is your newsletter content.\n\n— The team",
  footerNote:
    "You can unsubscribe from ticker updates in your account settings.",
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
