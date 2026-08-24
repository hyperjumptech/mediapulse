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
  /** Human-readable label for the daily review time, e.g. "9:00 AM WIB". */
  reviewTimeLabel?: string;
}

/**
 * Email sent when a user's subscription to a newsletter is successfully confirmed.
 *
 * @param props.tickerSymbol - The ticker symbol that was confirmed.
 * @param props.reviewTimeLabel - Optional label for the time the ticker is reviewed each day.
 * @returns The confirmation email React Email component.
 */
export const RegistrationConfirmationEmail = ({
  tickerSymbol,
  reviewTimeLabel,
}: RegistrationConfirmationEmailProps): ReactElement => {
  const reviewSentence =
    reviewTimeLabel !== undefined
      ? `We check ${tickerSymbol} news every day at ${reviewTimeLabel} and send you an issue only when there is news worth reading.`
      : `We check ${tickerSymbol} news every day and send you an issue only when there is news worth reading.`;

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
        Your subscription to the '{tickerSymbol}' newsletter is confirmed.
        {"\n\n"}
        {reviewSentence} On quiet days you will not hear from us, and nothing is
        wrong.
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
  reviewTimeLabel: "9:00 AM WIB",
} satisfies RegistrationConfirmationEmailProps;

export default RegistrationConfirmationEmail;
