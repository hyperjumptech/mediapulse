import { Button, Section, Text } from "@react-email/components";
import type { CSSProperties, ReactElement } from "react";

import {
  EmailDivider,
  EmailHeading,
  EmailParagraph,
  EmailShell,
} from "../shared/email-shell.js";

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
    <EmailShell
      preview="Confirm your MediaPulse subscription"
      footer={{
        note: "You are receiving this because someone requested MediaPulse updates using this email address.",
      }}
    >
      <EmailHeading>Confirm your subscription</EmailHeading>
      <EmailDivider />
      <EmailParagraph>
        {greeting}
        {"\n\n"}
        Please use the button below to confirm your subscription to the '
        {tickerSymbol}' newsletter on MediaPulse.
        {"\n\n"}
        If you did not request this subscription, you may disregard this email.
      </EmailParagraph>
      <Section style={buttonContainer}>
        <Button href={confirmUrl} className="e-button" style={button}>
          Confirm subscription
        </Button>
      </Section>
      <Text className="e-muted" style={linkFallback}>
        Alternatively, copy and paste the following link into your browser:
        {"\n"}
        {confirmUrl}
      </Text>
    </EmailShell>
  );
};

RegistrationPendingConfirmationEmail.PreviewProps = {
  tickerSymbol: "BBCA",
  name: "Alice",
  confirmUrl: "https://subscribe.example.com/api/confirm?token=abc",
} satisfies RegistrationPendingConfirmationEmailProps;

export default RegistrationPendingConfirmationEmail;

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
  margin: "16px 0 0",
  whiteSpace: "pre-wrap",
  wordBreak: "break-all",
};
