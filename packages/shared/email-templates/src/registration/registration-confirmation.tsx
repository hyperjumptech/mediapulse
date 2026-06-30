import type { ReactElement } from "react";

import {
  EmailCallout,
  EmailDivider,
  EmailHeading,
  EmailParagraph,
  EmailShell,
} from "../shared/email-shell.js";

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
 * @param props.nextDeliveryLabel - Optional label for the first delivery time.
 * @returns The confirmation email React Email component.
 */
export const RegistrationConfirmationEmail = ({
  tickerSymbol,
  nextDeliveryLabel,
}: RegistrationConfirmationEmailProps): ReactElement => {
  return (
    <EmailShell
      preview="Subscription Confirmed - MediaPulse"
      footer={{
        note: "You are receiving this because you subscribed to updates on MediaPulse.",
      }}
    >
      <EmailHeading>Subscription Confirmed</EmailHeading>
      <EmailDivider />
      <EmailParagraph>
        Hello,
        {"\n\n"}
        Your subscription to the '{tickerSymbol}' newsletter has been confirmed
        {nextDeliveryLabel !== undefined
          ? ` and you will receive your first newsletter ${nextDeliveryLabel}.`
          : "."}
      </EmailParagraph>
      <EmailCallout title="Add MediaPulse to your contacts">
        Open the attached contact card (.vcf) and select "Add to Contacts". This
        marks MediaPulse as a trusted sender, so future newsletters reach your
        inbox instead of the spam or promotions folder.
      </EmailCallout>
      <EmailParagraph>
        Thank you,
        {"\n"}
        The MediaPulse Team
      </EmailParagraph>
    </EmailShell>
  );
};

RegistrationConfirmationEmail.PreviewProps = {
  tickerSymbol: "AAPL",
  nextDeliveryLabel: "today at 9:00 AM WIB",
} satisfies RegistrationConfirmationEmailProps;

export default RegistrationConfirmationEmail;
