import {
  Body,
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

export interface RegistrationConfirmationEmailProps {
  /** The ticker symbol the user subscribed to. */
  tickerSymbol: string;
  /** Human-readable label for when the first newsletter will arrive, e.g. "today at 9:00 AM WIB". */
  nextDeliveryLabel?: string;
}

/**
 * Email sent when a user's subscription to a newsletter is successfully confirmed.
 *
 * @param props.tickerSymbol - The ticker symbol that was confirmed.
 * @returns The confirmation email React Email component.
 */
export const RegistrationConfirmationEmail = ({
  tickerSymbol,
  nextDeliveryLabel,
}: RegistrationConfirmationEmailProps): ReactElement => {
  return (
    <Html>
      <Head />
      <Preview>Subscription Confirmed - MediaPulse</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Heading style={heading}>Subscription Confirmed</Heading>
          </Section>
          <Hr style={hr} />
          <Text style={bodyParagraph}>
            Hello,
            {"\n\n"}
            Your subscription to the '{tickerSymbol}' newsletter has been
            confirmed.
            {nextDeliveryLabel !== undefined
              ? `\n\nYou will receive your first ${tickerSymbol} newsletter ${nextDeliveryLabel}.`
              : ""}
            {"\n\n"}
            Thank you,
            {"\n"}
            MediaPulse Team
          </Text>
          <Hr style={hr} />
          <Text style={footer}>
            You are receiving this because you subscribed to updates on
            MediaPulse.
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

RegistrationConfirmationEmail.PreviewProps = {
  tickerSymbol: "AAPL",
  nextDeliveryLabel: "today at 9:00 AM WIB",
} satisfies RegistrationConfirmationEmailProps;

export default RegistrationConfirmationEmail;

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
