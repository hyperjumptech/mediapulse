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

export interface InvalidTickerEmailProps {
  /** The ticker symbol the user tried to subscribe to. */
  tickerSymbol: string;
}

/**
 * Email sent when a user tries to subscribe to a ticker that is invalid or unrecognized.
 *
 * @param props.tickerSymbol - The ticker symbol that was rejected.
 * @returns The invalid ticker email React Email component.
 */
export const InvalidTickerEmail = ({
  tickerSymbol,
}: InvalidTickerEmailProps): ReactElement => {
  return (
    <Html>
      <Head />
      <Preview>Invalid Ticker Selection - MediaPulse</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Heading style={heading}>Invalid Ticker Selection</Heading>
          </Section>
          <Hr style={hr} />
          <Text style={bodyParagraph}>
            Hello,
            {"\n\n"}
            The ticker '{tickerSymbol}' you selected is invalid or not
            recognized by our system.
            {"\n\n"}
            Please visit the registration site and select a valid ticker.
            {"\n\n"}
            Thank you,
            {"\n"}
            MediaPulse Team
          </Text>
          <Hr style={hr} />
          <Text style={footer}>
            You are receiving this because you attempted to subscribe to updates
            on MediaPulse.
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

InvalidTickerEmail.PreviewProps = {
  tickerSymbol: "INVALID",
} satisfies InvalidTickerEmailProps;

export default InvalidTickerEmail;

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
