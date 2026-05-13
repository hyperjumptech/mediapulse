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

export interface AlreadySubscribedEmailProps {
  /** The ticker symbol the user is already subscribed to. */
  tickerSymbol: string;
}

/**
 * Email sent when a signup message is processed but the user already has an active,
 * confirmed subscription for the requested ticker.
 *
 * @param props.tickerSymbol - The ticker symbol for the existing subscription.
 * @returns The already-subscribed email React Email component.
 */
export const AlreadySubscribedEmail = ({
  tickerSymbol,
}: AlreadySubscribedEmailProps): ReactElement => {
  return (
    <Html>
      <Head />
      <Preview>You are already subscribed - MediaPulse</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Heading style={heading}>Already Subscribed</Heading>
          </Section>
          <Hr style={hr} />
          <Text style={bodyParagraph}>
            Hello,
            {"\n\n"}
            You already have an active subscription to the '{tickerSymbol}'
            newsletter. No further action is needed.
            {"\n\n"}
            Thank you,
            {"\n"}
            MediaPulse Team
          </Text>
          <Hr style={hr} />
          <Text style={footer}>
            You are receiving this because you sent a subscription request on
            MediaPulse.
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

AlreadySubscribedEmail.PreviewProps = {
  tickerSymbol: "AAPL",
} satisfies AlreadySubscribedEmailProps;

export default AlreadySubscribedEmail;

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
