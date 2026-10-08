import { Heading, Section, Text } from "@react-email/components";
import type { ReactElement } from "react";

import {
  ARTICLE_LINK_LABEL,
  buildNewsletterFooter,
} from "../newsletter/default-newsletter.js";
import { EmailArticle } from "../shared/email-article.js";
import {
  EmailDivider,
  EmailParagraph,
  EmailSectionHeader,
  EmailShell,
  type EmailLanguage,
} from "../shared/email-shell.js";
import {
  EmailHeaderPanel,
  EmailPill,
  EmailTickerBadge,
  EmailTimelineStep,
} from "../shared/email-visuals.js";

export const MAX_WELCOME_STORIES = 4;
export const MAX_WELCOME_STORY_POINTS = 2;
export const MAX_WELCOME_PEERS = 5;
export const MAX_WELCOME_CLASSIFICATION_LEVELS = 3;

export interface Day1WelcomeStory {
  title: string;
  url: string;
  source?: string;
  publishedAt?: string;
  points: string[];
}

export interface Day1WelcomeEmailProps {
  tickerSymbol: string;
  companyName: string;
  language?: EmailLanguage;
  reviewTimeLabel?: string;
  overview?: string;
  businessOperation?: string;
  classification?: string[];
  competitors?: string[];
  regulators?: string[];
  recentStories?: Day1WelcomeStory[];
  unsubscribeUrl?: string;
}

interface Day1WelcomeCopy {
  preview: (companyName: string) => string;
  intro: (companyName: string) => string;
  aboutLabel: string;
  aboutDescription: (companyName: string) => string;
  peersLabel: string;
  peersDescription: string;
  competesWith: string;
  regulatedBy: string;
  storiesLabel: string;
  storiesDescription: (ticker: string) => string;
  nextStepsLabel: string;
  nextStepsDescription: string;
  todayTitle: string;
  todayBody: string;
  dailyTitle: (reviewTimeLabel: string | undefined) => string;
  dailyBody: (ticker: string) => string;
  signOff: string;
}

export const DAY1_WELCOME_COPY: Record<EmailLanguage, Day1WelcomeCopy> = {
  en: {
    preview: (companyName) =>
      `A quick look at ${companyName} before your first issue`,
    intro: (companyName) =>
      `Here is what you need to know about ${companyName} before your first daily issue.`,
    aboutLabel: "The company",
    aboutDescription: (companyName) => `What ${companyName} does.`,
    peersLabel: "Who it's up against",
    peersDescription: "Its competitors and regulators.",
    competesWith: "Competitors",
    regulatedBy: "Regulators",
    storiesLabel: "What's happening",
    storiesDescription: (ticker) => `The latest news about ${ticker}.`,
    nextStepsLabel: "What happens next",
    nextStepsDescription: "How MediaPulse works for you from today.",
    todayTitle: "Today",
    todayBody: "This email, to help you get to know the company.",
    dailyTitle: (reviewTimeLabel) =>
      reviewTimeLabel !== undefined
        ? `Every day at ${reviewTimeLabel}`
        : "Every day",
    dailyBody: (ticker) =>
      `You get an issue whenever ${ticker} has news worth your time.`,
    signOff: "Thank you,\nThe MediaPulse Team",
  },
  id: {
    preview: (companyName) =>
      `Gambaran singkat ${companyName} sebelum edisi pertama Anda`,
    intro: (companyName) =>
      `Berikut yang perlu Anda ketahui tentang ${companyName} sebelum edisi harian pertama Anda.`,
    aboutLabel: "Perusahaan",
    aboutDescription: (companyName) => `Bidang usaha ${companyName}.`,
    peersLabel: "Lawan dan pengawas",
    peersDescription: "Pesaing dan regulatornya.",
    competesWith: "Pesaing",
    regulatedBy: "Regulator",
    storiesLabel: "Kabar terbaru",
    storiesDescription: (ticker) => `Berita terbaru tentang ${ticker}.`,
    nextStepsLabel: "Selanjutnya",
    nextStepsDescription:
      "Begini cara kerja MediaPulse untuk Anda mulai hari ini.",
    todayTitle: "Hari ini",
    todayBody: "Email ini, agar Anda mengenal perusahaannya.",
    dailyTitle: (reviewTimeLabel) =>
      reviewTimeLabel !== undefined
        ? `Setiap hari pukul ${reviewTimeLabel}`
        : "Setiap hari",
    dailyBody: (ticker) =>
      `Anda menerima edisi setiap kali ada berita ${ticker} yang layak Anda baca.`,
    signOff: "Terima kasih,\nTim MediaPulse",
  },
};

const LOCALE: Record<EmailLanguage, string> = {
  en: "en-GB",
  id: "id-ID",
};

const SECTION_PARAGRAPH_CLASS_NAME =
  "e-body m-0 mb-3 whitespace-pre-wrap text-[15px] leading-[1.65] text-body";

const PILL_GROUP_LABEL_CLASS_NAME =
  "e-muted m-0 mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted";

export const formatStoryDate = (
  publishedAt: string | undefined,
  language: EmailLanguage,
): string | undefined => {
  if (publishedAt === undefined) {
    return undefined;
  }

  const publishedDate = new Date(publishedAt);

  if (Number.isNaN(publishedDate.getTime())) {
    return undefined;
  }

  const formatter = new Intl.DateTimeFormat(LOCALE[language], {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });

  return formatter.format(publishedDate);
};

const nonBlank = (values: string[] | undefined): string[] =>
  (values ?? [])
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

const trimmedOrUndefined = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim() ?? "";

  return trimmed.length > 0 ? trimmed : undefined;
};

export const Day1WelcomeEmail = ({
  tickerSymbol,
  companyName,
  language = "en",
  reviewTimeLabel,
  overview,
  businessOperation,
  classification,
  competitors,
  regulators,
  recentStories,
  unsubscribeUrl,
}: Day1WelcomeEmailProps): ReactElement => {
  const copy = DAY1_WELCOME_COPY[language];
  const ticker = tickerSymbol.trim();
  const footer = buildNewsletterFooter({
    tickerSymbol: ticker,
    language,
    unsubscribeUrl,
  });
  const visibleOverview = trimmedOrUndefined(overview);
  const visibleBusinessOperation = trimmedOrUndefined(businessOperation);
  const classificationLevels = nonBlank(classification).slice(
    0,
    MAX_WELCOME_CLASSIFICATION_LEVELS,
  );
  const allCompetitors = nonBlank(competitors);
  const allRegulators = nonBlank(regulators);
  const visibleCompetitors = allCompetitors.slice(0, MAX_WELCOME_PEERS);
  const visibleRegulators = allRegulators.slice(0, MAX_WELCOME_PEERS);
  const visibleStories = (recentStories ?? []).slice(0, MAX_WELCOME_STORIES);
  const hasAbout =
    classificationLevels.length > 0 ||
    visibleOverview !== undefined ||
    visibleBusinessOperation !== undefined;
  const hasPeers =
    visibleCompetitors.length > 0 || visibleRegulators.length > 0;

  const renderStory = (
    story: Day1WelcomeStory,
    isLast: boolean,
  ): ReactElement => (
    <EmailArticle
      title={story.title}
      url={story.url}
      source={story.source}
      detail={formatStoryDate(story.publishedAt, language)}
      linkLabel={ARTICLE_LINK_LABEL[language]}
      points={story.points.slice(0, MAX_WELCOME_STORY_POINTS)}
      isLast={isLast}
    />
  );

  return (
    <EmailShell preview={copy.preview(companyName)} footer={footer}>
      <EmailHeaderPanel>
        <EmailTickerBadge tickerSymbol={ticker} />
        <Heading className="e-ink mb-0 mt-3 text-xl font-bold leading-tight text-ink">
          {companyName}
        </Heading>
      </EmailHeaderPanel>

      <EmailParagraph>{copy.intro(companyName)}</EmailParagraph>

      {hasAbout ? (
        <>
          <EmailDivider />
          <Section>
            <EmailSectionHeader
              label={copy.aboutLabel}
              description={copy.aboutDescription(companyName)}
            />
            {classificationLevels.length > 0 ? (
              <Text className="e-muted m-0 mb-3 text-xs font-semibold uppercase tracking-[0.06em] text-muted">
                {classificationLevels.join(" · ")}
              </Text>
            ) : null}
            {visibleOverview !== undefined ? (
              <Text className={SECTION_PARAGRAPH_CLASS_NAME}>
                {visibleOverview}
              </Text>
            ) : null}
            {visibleBusinessOperation !== undefined ? (
              <Text className={SECTION_PARAGRAPH_CLASS_NAME}>
                {visibleBusinessOperation}
              </Text>
            ) : null}
          </Section>
        </>
      ) : null}

      {hasPeers ? (
        <>
          <EmailDivider />
          <Section>
            <EmailSectionHeader
              label={copy.peersLabel}
              description={copy.peersDescription}
            />
            {visibleCompetitors.length > 0 ? (
              <Section className="mb-2">
                <Text className={PILL_GROUP_LABEL_CLASS_NAME}>
                  {copy.competesWith}
                </Text>
                <Text className="m-0">
                  {visibleCompetitors.map((competitor) => (
                    <EmailPill key={competitor}>{competitor}</EmailPill>
                  ))}
                </Text>
              </Section>
            ) : null}
            {visibleRegulators.length > 0 ? (
              <Section>
                <Text className={PILL_GROUP_LABEL_CLASS_NAME}>
                  {copy.regulatedBy}
                </Text>
                <Text className="m-0">
                  {visibleRegulators.map((regulator) => (
                    <EmailPill key={regulator}>{regulator}</EmailPill>
                  ))}
                </Text>
              </Section>
            ) : null}
          </Section>
        </>
      ) : null}

      {visibleStories.length > 0 ? (
        <>
          <EmailDivider />
          <Section>
            <EmailSectionHeader
              label={copy.storiesLabel}
              description={copy.storiesDescription(ticker)}
            />
            {visibleStories.map((story, storyIndex) => (
              <Section key={`story-${String(storyIndex)}`}>
                {renderStory(story, storyIndex === visibleStories.length - 1)}
              </Section>
            ))}
          </Section>
        </>
      ) : null}

      <EmailDivider />
      <Section>
        <EmailSectionHeader
          label={copy.nextStepsLabel}
          description={copy.nextStepsDescription}
        />
        <EmailTimelineStep title={copy.todayTitle}>
          {copy.todayBody}
        </EmailTimelineStep>
        <EmailTimelineStep title={copy.dailyTitle(reviewTimeLabel)}>
          {copy.dailyBody(ticker)}
        </EmailTimelineStep>
      </Section>
      <EmailDivider />
      <EmailParagraph>{copy.signOff}</EmailParagraph>
    </EmailShell>
  );
};

Day1WelcomeEmail.PreviewProps = {
  tickerSymbol: "ACME",
  companyName: "Acme Telekomunikasi",
  reviewTimeLabel: "9:00 AM WIB",
  overview:
    "Integrated telecom operator serving mobile, home fiber and enterprise customers across Indonesia, with the largest fiber backbone outside the state incumbent.",
  businessOperation:
    "Sells prepaid and postpaid mobile plans, home-fiber broadband bundles and managed connectivity for enterprises. Leases spare tower and fiber capacity to other operators.",
  classification: [
    "Infrastructures",
    "Telecommunication",
    "Integrated Telecom",
  ],
  competitors: ["Contoso Mobile", "Fabrikam Cellular", "Northwind Net"],
  regulators: [
    "Ministry of Communication and Digital Affairs",
    "Financial Services Authority (OJK)",
  ],
  recentStories: [
    {
      title: "Acme extends home-fiber lead",
      source: "Market Wire",
      url: "https://example.com/acme/home-fiber",
      publishedAt: "2026-10-03T02:00:00.000Z",
      points: [
        "Added roughly 320,000 home-fiber subscribers in the quarter.",
        "Widened its lead as rivals struggled to match backbone reach.",
      ],
    },
    {
      title: "Acme holds full-year capex guidance",
      source: "Market Wire",
      url: "https://example.com/acme/capex-guidance",
      publishedAt: "2026-10-01T09:30:00.000Z",
      points: [
        "Reaffirmed its full-year capex guidance at the earnings call.",
        "No change to the fiber build target for the year.",
      ],
    },
    {
      title: "Regulator signals mid-band spectrum auction",
      source: "Policy Brief",
      url: "https://example.com/policy/spectrum-auction",
      publishedAt: "2026-09-29T04:15:00.000Z",
      points: [
        "The regulator signalled an auction for next year, the first since 2021.",
        "Analysts expect Acme to bid for mid-band blocks to extend 5G beyond the capital.",
      ],
    },
  ],
  unsubscribeUrl: "https://example.com/api/unsubscribe?token=preview",
} satisfies Day1WelcomeEmailProps;

export default Day1WelcomeEmail;
