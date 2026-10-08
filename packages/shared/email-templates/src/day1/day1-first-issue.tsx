import { Text } from "@react-email/components";
import type { ReactElement } from "react";

import {
  DefaultNewsletterEmail,
  NEWSLETTER_PREVIEW_PROPS,
  type DefaultNewsletterEmailProps,
} from "../newsletter/default-newsletter.js";
import type { EmailLanguage } from "../shared/email-shell.js";
import { EmailHeaderPanel, EmailInverseTag } from "../shared/email-visuals.js";

export interface Day1FirstIssueEmailProps extends DefaultNewsletterEmailProps {
  tickerSymbol: string;
  reviewTimeLabel?: string;
}

interface Day1FirstIssueCopy {
  badge: string;
  welcomeBody: (ticker: string, reviewTimeLabel: string | undefined) => string;
  footerNote: (ticker: string) => string;
}

export const DAY1_FIRST_ISSUE_COPY: Record<EmailLanguage, Day1FirstIssueCopy> =
  {
    en: {
      badge: "First issue",
      welcomeBody: (ticker, reviewTimeLabel) =>
        reviewTimeLabel !== undefined
          ? `Here is your first ${ticker} issue. From now on, you get an issue at ${reviewTimeLabel} on days when ${ticker} has news worth your time.`
          : `Here is your first ${ticker} issue. More issues arrive only when ${ticker} has news worth your time.`,
      footerNote: (ticker) =>
        `You are receiving this because you just subscribed to ${ticker} updates.`,
    },
    id: {
      badge: "Edisi perdana",
      welcomeBody: (ticker, reviewTimeLabel) =>
        reviewTimeLabel !== undefined
          ? `Ini edisi ${ticker} pertama Anda. Mulai sekarang, Anda menerima edisi pukul ${reviewTimeLabel} pada hari ada berita ${ticker} yang layak Anda baca.`
          : `Ini edisi ${ticker} pertama Anda. Edisi berikutnya datang hanya saat ada berita ${ticker} yang layak Anda baca.`,
      footerNote: (ticker) =>
        `Anda menerima email ini karena Anda baru saja berlangganan pembaruan ${ticker}.`,
    },
  };

export const Day1FirstIssueEmail = ({
  tickerSymbol,
  reviewTimeLabel,
  footerNote,
  language = "en",
  ...newsletterProps
}: Day1FirstIssueEmailProps): ReactElement => {
  const copy = DAY1_FIRST_ISSUE_COPY[language];
  const trimmedTicker = tickerSymbol.trim();
  const welcomeBody = copy.welcomeBody(trimmedTicker, reviewTimeLabel);
  const resolvedFooterNote = footerNote ?? copy.footerNote(trimmedTicker);
  const welcomeNote = (
    <EmailHeaderPanel compact>
      <Text className="m-0 mb-2 leading-none">
        <EmailInverseTag>{copy.badge}</EmailInverseTag>
      </Text>
      <Text className="e-body m-0 text-sm leading-relaxed text-body">
        {welcomeBody}
      </Text>
    </EmailHeaderPanel>
  );

  return (
    <DefaultNewsletterEmail
      {...newsletterProps}
      tickerSymbol={tickerSymbol}
      language={language}
      footerNote={resolvedFooterNote}
      lead={welcomeNote}
    />
  );
};

Day1FirstIssueEmail.PreviewProps = {
  ...NEWSLETTER_PREVIEW_PROPS,
  title: "Your first ACME briefing: Fixed broadband steadies the sector",
  reviewTimeLabel: "9:00 AM WIB",
} satisfies Day1FirstIssueEmailProps;

export default Day1FirstIssueEmail;
