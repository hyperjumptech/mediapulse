import { Column, Heading, Row, Section, Text } from "@react-email/components";
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
  EmailBarRow,
  EmailHeaderPanel,
  EmailPill,
  EmailStatStrip,
  EmailTickerBadge,
  EmailTimelineStep,
  type EmailStat,
} from "../shared/email-visuals.js";

export const MAX_WELCOME_STORIES = 4;
export const MAX_WELCOME_STORY_POINTS = 2;
export const MAX_WELCOME_NAMED_ENTITIES = 5;
export const MAX_WELCOME_PEERS = 5;
export const MAX_WELCOME_CLASSIFICATION_LEVELS = 3;

const MIN_WELCOME_STATS = 2;

export interface Day1WelcomeStory {
  title: string;
  url: string;
  source?: string;
  publishedAt?: string;
  points: string[];
}

export interface Day1WelcomeNamedEntity {
  name: string;
  articleCount: number;
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
  articlesRead?: number;
  namesTracked?: number;
  recentStories?: Day1WelcomeStory[];
  inTheNews?: Day1WelcomeNamedEntity[];
  unsubscribeUrl?: string;
}

interface Day1WelcomeCopy {
  preview: (companyName: string) => string;
  intro: (ticker: string) => string;
  articlesReadLabel: (count: number) => string;
  namesTrackedLabel: (count: number) => string;
  rivalsLabel: (count: number) => string;
  aboutLabel: string;
  aboutDescription: string;
  peersLabel: string;
  peersDescription: string;
  competesWith: string;
  regulatedBy: string;
  storiesLabel: string;
  storiesDescription: (ticker: string) => string;
  leadStory: string;
  inTheNewsLabel: (ticker: string) => string;
  inTheNewsDescription: (ticker: string) => string;
  articleCount: (formattedCount: string, count: number) => string;
  nextStepsLabel: string;
  nextStepsDescription: string;
  todayTitle: string;
  todayBody: string;
  dailyTitle: (reviewTimeLabel: string | undefined) => string;
  dailyBody: (ticker: string) => string;
  quietTitle: string;
  quietBody: string;
  signOff: string;
}

export const DAY1_WELCOME_COPY: Record<EmailLanguage, Day1WelcomeCopy> = {
  en: {
    preview: (companyName) =>
      `A quick primer on ${companyName} before your first issue`,
    intro: (ticker) =>
      `Thanks for following ${ticker}. Here is a quick primer on the company and what the news has been saying, so your first daily issue lands with context.`,
    articlesReadLabel: (count) => (count === 1 ? "story read" : "stories read"),
    namesTrackedLabel: (count) =>
      count === 1 ? "name tracked" : "names tracked",
    rivalsLabel: (count) => (count === 1 ? "rival watched" : "rivals watched"),
    aboutLabel: "The company in brief",
    aboutDescription: "What it does and how it makes money.",
    peersLabel: "Who it's up against",
    peersDescription: "Its rivals, and the regulators that set the rules.",
    competesWith: "Competes with",
    regulatedBy: "Regulated by",
    storiesLabel: "What's happening",
    storiesDescription: (ticker) =>
      `The latest ${ticker} stories we have read.`,
    leadStory: "Lead story",
    inTheNewsLabel: (ticker) => `Who shows up next to ${ticker}`,
    inTheNewsDescription: (ticker) =>
      `Names that appear most in ${ticker} coverage, by article count.`,
    articleCount: (formattedCount, count) =>
      count === 1 ? "1 article" : `${formattedCount} articles`,
    nextStepsLabel: "What happens next",
    nextStepsDescription: "How MediaPulse works for you from today.",
    todayTitle: "Today",
    todayBody: "This primer, so you know the company before the news starts.",
    dailyTitle: (reviewTimeLabel) =>
      reviewTimeLabel !== undefined
        ? `Every day at ${reviewTimeLabel}`
        : "Every day",
    dailyBody: (ticker) =>
      `We read the latest ${ticker} news and decide whether it is worth your time.`,
    quietTitle: "Only when it matters",
    quietBody:
      "An issue lands only when there is news worth reading. A quiet day means no email, and nothing is wrong.",
    signOff: "Thank you,\nThe MediaPulse Team",
  },
  id: {
    preview: (companyName) =>
      `Gambaran singkat ${companyName} sebelum edisi pertama Anda`,
    intro: (ticker) =>
      `Terima kasih telah mengikuti ${ticker}. Berikut gambaran singkat tentang perusahaan dan apa yang diberitakan, agar edisi harian pertama Anda lebih mudah dipahami.`,
    articlesReadLabel: () => "berita dibaca",
    namesTrackedLabel: () => "nama dipantau",
    rivalsLabel: () => "pesaing dipantau",
    aboutLabel: "Sekilas perusahaan",
    aboutDescription: "Apa yang dikerjakan dan dari mana pendapatannya.",
    peersLabel: "Lawan dan pengawas",
    peersDescription: "Pesaingnya, dan regulator yang menetapkan aturannya.",
    competesWith: "Bersaing dengan",
    regulatedBy: "Diatur oleh",
    storiesLabel: "Kabar terbaru",
    storiesDescription: (ticker) =>
      `Berita ${ticker} terbaru yang sudah kami baca.`,
    leadStory: "Berita utama",
    inTheNewsLabel: (ticker) => `Yang sering muncul bersama ${ticker}`,
    inTheNewsDescription: (ticker) =>
      `Nama yang paling sering muncul dalam pemberitaan ${ticker}, menurut jumlah artikel.`,
    articleCount: (formattedCount) => `${formattedCount} artikel`,
    nextStepsLabel: "Selanjutnya",
    nextStepsDescription:
      "Begini cara kerja MediaPulse untuk Anda mulai hari ini.",
    todayTitle: "Hari ini",
    todayBody:
      "Gambaran singkat ini, agar Anda mengenal perusahaannya sebelum berita mulai berdatangan.",
    dailyTitle: (reviewTimeLabel) =>
      reviewTimeLabel !== undefined
        ? `Setiap hari pukul ${reviewTimeLabel}`
        : "Setiap hari",
    dailyBody: (ticker) =>
      `Kami membaca berita ${ticker} terbaru dan menilai apakah layak untuk Anda.`,
    quietTitle: "Hanya saat penting",
    quietBody:
      "Edisi hanya dikirim saat ada berita yang layak dibaca. Hari yang sepi berarti tanpa email, dan itu bukan masalah.",
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

const formatCount = (count: number, language: EmailLanguage): string =>
  new Intl.NumberFormat(LOCALE[language]).format(count);

const nonBlank = (values: string[] | undefined): string[] =>
  (values ?? [])
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

const trimmedOrUndefined = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim() ?? "";

  return trimmed.length > 0 ? trimmed : undefined;
};

const buildStats = ({
  articlesRead,
  namesTracked,
  rivalCount,
  language,
  copy,
}: {
  articlesRead: number | undefined;
  namesTracked: number | undefined;
  rivalCount: number;
  language: EmailLanguage;
  copy: Day1WelcomeCopy;
}): EmailStat[] => {
  const stats: EmailStat[] = [];

  if (articlesRead !== undefined && articlesRead > 0) {
    stats.push({
      value: formatCount(articlesRead, language),
      label: copy.articlesReadLabel(articlesRead),
    });
  }

  if (namesTracked !== undefined && namesTracked > 0) {
    stats.push({
      value: formatCount(namesTracked, language),
      label: copy.namesTrackedLabel(namesTracked),
    });
  }

  if (rivalCount > 0) {
    stats.push({
      value: formatCount(rivalCount, language),
      label: copy.rivalsLabel(rivalCount),
    });
  }

  return stats;
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
  articlesRead,
  namesTracked,
  recentStories,
  inTheNews,
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
  const visibleCompetitors = allCompetitors.slice(0, MAX_WELCOME_PEERS);
  const visibleRegulators = nonBlank(regulators).slice(0, MAX_WELCOME_PEERS);
  const stats = buildStats({
    articlesRead,
    namesTracked,
    rivalCount: allCompetitors.length,
    language,
    copy,
  });
  const [leadStory, ...otherStories] = (recentStories ?? []).slice(
    0,
    MAX_WELCOME_STORIES,
  );
  const visibleNamedEntities = (inTheNews ?? []).slice(
    0,
    MAX_WELCOME_NAMED_ENTITIES,
  );
  const highestArticleCount = Math.max(
    1,
    ...visibleNamedEntities.map((namedEntity) => namedEntity.articleCount),
  );
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
        <Row>
          <Column style={{ width: "80px", verticalAlign: "middle" }}>
            <EmailTickerBadge tickerSymbol={ticker} />
          </Column>
          <Column style={{ verticalAlign: "middle" }}>
            <Heading className="e-ink m-0 text-2xl font-bold leading-tight text-ink">
              {companyName}
            </Heading>
          </Column>
        </Row>
      </EmailHeaderPanel>

      <EmailParagraph>{copy.intro(ticker)}</EmailParagraph>

      {stats.length >= MIN_WELCOME_STATS ? (
        <Section className="mt-6">
          <EmailStatStrip stats={stats} />
        </Section>
      ) : null}

      {hasAbout ? (
        <>
          <EmailDivider />
          <Section>
            <EmailSectionHeader
              label={copy.aboutLabel}
              description={copy.aboutDescription}
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

      {leadStory !== undefined ? (
        <>
          <EmailDivider />
          <Section>
            <EmailSectionHeader
              label={copy.storiesLabel}
              description={copy.storiesDescription(ticker)}
            />
            <Section className="e-tile mb-6 rounded-xl border border-solid border-rule bg-canvas px-5 py-5">
              <Text className="e-accent m-0 mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-brand">
                {copy.leadStory}
              </Text>
              {renderStory(leadStory, true)}
            </Section>
            {otherStories.map((story, storyIndex) => (
              <Section key={`story-${String(storyIndex)}`}>
                {renderStory(story, storyIndex === otherStories.length - 1)}
              </Section>
            ))}
          </Section>
        </>
      ) : null}

      {visibleNamedEntities.length > 0 ? (
        <>
          <EmailDivider />
          <Section>
            <EmailSectionHeader
              label={copy.inTheNewsLabel(ticker)}
              description={copy.inTheNewsDescription(ticker)}
            />
            {visibleNamedEntities.map((namedEntity) => (
              <EmailBarRow
                key={namedEntity.name}
                label={namedEntity.name}
                valueLabel={copy.articleCount(
                  formatCount(namedEntity.articleCount, language),
                  namedEntity.articleCount,
                )}
                ratio={namedEntity.articleCount / highestArticleCount}
              />
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
        <EmailTimelineStep step={1} title={copy.todayTitle}>
          {copy.todayBody}
        </EmailTimelineStep>
        <EmailTimelineStep step={2} title={copy.dailyTitle(reviewTimeLabel)}>
          {copy.dailyBody(ticker)}
        </EmailTimelineStep>
        <EmailTimelineStep step={3} title={copy.quietTitle}>
          {copy.quietBody}
        </EmailTimelineStep>
      </Section>
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
  articlesRead: 128,
  namesTracked: 46,
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
        "An auction was signalled for next year, the first since 2021.",
        "Acme is expected to bid for mid-band blocks to extend 5G beyond the capital.",
      ],
    },
  ],
  inTheNews: [
    { name: "Contoso Mobile", articleCount: 14 },
    { name: "Ministry of Communication and Digital Affairs", articleCount: 9 },
    { name: "Northwind Towers", articleCount: 6 },
    { name: "Fabrikam Cellular", articleCount: 4 },
  ],
  unsubscribeUrl: "https://example.com/api/unsubscribe?token=preview",
} satisfies Day1WelcomeEmailProps;

export default Day1WelcomeEmail;
