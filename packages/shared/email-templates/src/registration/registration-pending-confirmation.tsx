import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { CSSProperties, ReactElement } from "react";

export interface RegistrationPendingConfirmationEmailProps {
  /** The ticker symbol the user wants to subscribe to. */
  tickerSymbol: string;
  /** Optional subscriber display name for greeting. */
  name?: string | null;
  /** Absolute URL the recipient clicks to confirm the subscription. */
  confirmUrl: string;
}

/**
 * Email sent when a user chooses the web confirmation path during signup.
 *
 * @param props.tickerSymbol - The ticker symbol pending confirmation.
 * @param props.name - Optional subscriber display name.
 * @param props.confirmUrl - Link to confirm the subscription.
 * @returns The pending confirmation React Email component.
 */
export const RegistrationPendingConfirmationEmail = ({
  tickerSymbol,
  name,
  confirmUrl,
}: RegistrationPendingConfirmationEmailProps): ReactElement => {
  const greeting = name?.trim() ? `Hello ${name.trim()},` : "Hello,";

  return (
    <Html>
      <Head />
      <Preview>Confirm your MediaPulse subscription</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Heading style={heading}>Confirm your subscription</Heading>
          </Section>
          <Hr style={hr} />
          <Text style={bodyParagraph}>
            {greeting}
            {"\n\n"}
            Tap the button below to confirm your subscription to the '
            {tickerSymbol}' newsletter on MediaPulse.
            {"\n\n"}
            If you did not request this, you can ignore this email.
          </Text>
          <Section style={buttonContainer}>
            <Button href={confirmUrl} style={button}>
              Confirm subscription
            </Button>
          </Section>
          <Text style={linkFallback}>
            Or copy and paste this link into your browser:
            {"\n"}
            {confirmUrl}
          </Text>
          <Hr style={hr} />
          <Text style={footer}>
            You are receiving this because someone requested MediaPulse updates
            using this email address.
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

RegistrationPendingConfirmationEmail.PreviewProps = {
  tickerSymbol: "BBCA",
  name: "Alice",
  confirmUrl: "https://subscribe.example.com/api/confirm?token=abc",
} satisfies RegistrationPendingConfirmationEmailProps;

export default RegistrationPendingConfirmationEmail;

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

const buttonContainer: CSSProperties = {
  margin: "24px 0",
  textAlign: "center",
};

const button: CSSProperties = {
  backgroundColor: "#111827",
  borderRadius: "6px",
  color: "#ffffff",
  display: "inline-block",
  fontSize: "16px",
  fontWeight: "600",
  lineHeight: "1.25",
  padding: "12px 24px",
  textDecoration: "none",
};

const linkFallback: CSSProperties = {
  color: "#6b7280",
  fontSize: "13px",
  lineHeight: "1.5",
  margin: "0",
  whiteSpace: "pre-wrap",
  wordBreak: "break-all",
};

const footer: CSSProperties = {
  color: "#6b7280",
  fontSize: "12px",
  lineHeight: "1.5",
  margin: "0 0 8px",
};
