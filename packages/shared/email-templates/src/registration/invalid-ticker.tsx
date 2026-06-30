import type { ReactElement } from "react";

import {
  EmailDivider,
  EmailHeading,
  EmailParagraph,
  EmailShell,
} from "../shared/email-shell.js";

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
    <EmailShell
      preview="Invalid Ticker Selection - MediaPulse"
      footer={{
        note: "You are receiving this because you attempted to subscribe to updates on MediaPulse.",
      }}
    >
      <EmailHeading>Invalid Ticker Selection</EmailHeading>
      <EmailDivider />
      <EmailParagraph>
        Hello,
        {"\n\n"}
        The ticker '{tickerSymbol}' you selected is invalid or not recognized by
        our system.
        {"\n\n"}
        Please visit the registration site and select a valid ticker.
        {"\n\n"}
        Thank you,
        {"\n"}
        The MediaPulse Team
      </EmailParagraph>
    </EmailShell>
  );
};

InvalidTickerEmail.PreviewProps = {
  tickerSymbol: "INVALID",
} satisfies InvalidTickerEmailProps;

export default InvalidTickerEmail;
