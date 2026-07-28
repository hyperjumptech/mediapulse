import { prisma } from "@mediapulse/database";
import { logger } from "@workspace/logger";
import type {
  PostContentGenerationBody,
  PostContentGenerationFetchedContentBody,
} from "@workspace/agent-data-api-contract";

import type { Prisma } from "@mediapulse/database";

import { flattenBulletsFromNewsletterDocument } from "../lib/flatten-newsletter-bullets.js";
import { parseProfileParties } from "./ticker-profile-parties.js";

const MAX_RECENT_BULLETS = 200;

/**
 * Rolling lookback (hours) for the source-selection window in {@link getDataSourcesForTicker}.
 *
 * - Important: this must match the window used by the domain-api newsletter-detail mirror
 *   (`domain-api/src/resources/newsletters/selected-sources-window.ts`). Changing one without the
 *   other makes the detail view disagree with what the agent could actually select.
 *
 * The pipeline runs at ~02:00 UTC; a 24h window reaches back to ~02:00 UTC the prior day so a full
 * collect→analyze cycle is visible, instead of the ~2h that a UTC-calendar-day boundary yields.
 */
const SOURCE_LOOKBACK_HOURS = 24;

type ContentGenerationDb = {
  dataSource: Pick<typeof prisma.dataSource, "update">;
  dataSourceTickerSection: Pick<
    typeof prisma.dataSourceTickerSection,
    "findMany"
  >;
  ticker: Pick<typeof prisma.ticker, "findUniqueOrThrow" | "findUnique">;
  newsletter: Pick<
    typeof prisma.newsletter,
    "create" | "findFirst" | "findMany"
  >;
  searchQuerySet: Pick<typeof prisma.searchQuerySet, "findFirst">;
  userTicker: Pick<typeof prisma.userTicker, "findMany">;
};

/**
 * Returns the recently classified data sources for a ticker, plus the ticker's name, symbol,
 * competitors, and issuer aliases. Reads the per-(article, ticker) section table.
 *
 * Sources are selected with a rolling ``SOURCE_LOOKBACK_HOURS`` window (`analyzedAt >= now - lookback`)
 * so a full collect→analyze cycle is visible at the ~02:00 UTC run time, rather than the ~2h a
 * UTC-calendar-day boundary would yield.
 *
 * @param tickerId - Ticker id used to scope the per-ticker section rows.
 * @param deps - Optional dependencies for database and current time.
 * @returns Data sources sectioned for this ticker within the lookback window, ordered by section score desc.
 */
export const getDataSourcesForTicker = async (
  tickerId: string,
  deps: {
    db?: Pick<
      ContentGenerationDb,
      "dataSourceTickerSection" | "ticker" | "userTicker"
    >;
    now?: () => Date;
  } = {},
) => {
  const { db = prisma, now = () => new Date() } = deps;
  const cutoff = new Date(now().getTime() - SOURCE_LOOKBACK_HOURS * 3_600_000);

  const [ticker, sectionRows] = await Promise.all([
    db.ticker.findUniqueOrThrow({
      where: { id: tickerId },
      select: {
        symbol: true,
        name: true,
        aliases: true,
        profile: { select: { aliases: true, competitors: true } },
      },
    } satisfies Prisma.TickerFindUniqueOrThrowArgs),
    db.dataSourceTickerSection.findMany({
      where: {
        tickerId,
        section: { not: null },
        analyzedAt: { gte: cutoff },
      },
      select: {
        section: true,
        sectionScore: true,
        sectionReason: true,
        dataSource: {
          select: {
            id: true,
            url: true,
            title: true,
            description: true,
            content: true,
            author: true,
            source: true,
            searchQueryId: true,
            metadata: true,
            publishedAt: true,
          },
        },
      },
      orderBy: { sectionScore: "desc" },
    } satisfies Prisma.DataSourceTickerSectionFindManyArgs),
  ]);

  const dataSources = sectionRows.map((row) => ({
    dataSourceId: row.dataSource.id,
    url: row.dataSource.url,
    title: row.dataSource.title,
    description: row.dataSource.description,
    content: row.dataSource.content,
    author: row.dataSource.author,
    source: row.dataSource.source,
    tickerId,
    searchQueryId: row.dataSource.searchQueryId,
    section: row.section,
    sectionScore: row.sectionScore,
    sectionReason: row.sectionReason,
  }));

  const profile = ticker.profile ?? null;
  const issuerAliases: string[] = [
    ...new Set(
      [
        ticker.symbol,
        ticker.name,
        ...(ticker.aliases ?? []),
        ...(profile?.aliases ?? []),
      ].filter((value) => value.length > 0),
    ),
  ];
  const competitors = (
    profile === null ? [] : parseProfileParties(profile.competitors)
  ).map((entry) => ({ name: entry.name, relation: "COMPETITOR" }));

  const subscriberLanguageRows = await db.userTicker.findMany({
    where: { tickerId, enabled: true, language: { not: "en" } },
    select: { language: true },
    distinct: ["language"],
  } satisfies Prisma.UserTickerFindManyArgs);
  const subscriberLanguages = subscriberLanguageRows.map((row) => row.language);

  return {
    dataSources,
    tickerSymbol: ticker.symbol,
    tickerName: ticker.name,
    competitors,
    issuerAliases,
    subscriberLanguages,
  };
};

/**
 * Creates a newsletter row generated by the content-generation agent.
 *
 * @param data - Newsletter payload received from content-generation.
 * @param db - Database dependency, injectable for tests.
 * @returns Created newsletter record.
 */
export const createNewsletter = async (
  data: PostContentGenerationBody,
  db: Pick<ContentGenerationDb, "newsletter" | "searchQuerySet"> = prisma,
) => {
  const activeSet = await db.searchQuerySet.findFirst({
    where: { tickerId: data.tickerId, isActive: true },
    orderBy: { generatedAt: "desc" },
    select: { id: true },
  });

  const newsletter = await db.newsletter.create({
    data: {
      subject: data.subject,
      content: data.content,
      tickerId: data.tickerId,
      searchQuerySetId: activeSet?.id ?? null,
      model: data.model ?? null,
      agentVersion: data.agentVersion ?? null,
      configVersion: data.configVersion ?? null,
      promptHash: data.promptHash ?? null,
      configSnapshotId: data.configSnapshotId ?? null,
      promptTokens: data.promptTokens ?? null,
      completionTokens: data.completionTokens ?? null,
      totalTokens: data.totalTokens ?? null,
    },
  });
  logger.info(
    { tickerId: data.tickerId, newsletterId: newsletter.id },
    "Created newsletter for ticker",
  );
  return newsletter;
};

export const updateFetchedContent = async (
  items: PostContentGenerationFetchedContentBody,
  deps: {
    db?: Pick<ContentGenerationDb, "dataSource">;
    now?: () => Date;
  } = {},
): Promise<{ updatedCount: number }> => {
  const { db = prisma, now = () => new Date() } = deps;
  const fetchedAt = now();
  let updatedCount = 0;

  for (const item of items) {
    try {
      await db.dataSource.update({
        where: { id: item.dataSourceId },
        data: {
          content: item.content,
          fetchedAt,
          fetchProvider: item.fetchProvider,
        },
      } satisfies Prisma.DataSourceUpdateArgs);
      updatedCount += 1;
    } catch (error) {
      logger.warn(
        { dataSourceId: item.dataSourceId, err: error },
        "Failed to persist fetched content for data source",
      );
    }
  }

  return { updatedCount };
};

/**
 * Checks whether a newsletter already exists for a given ticker within a
 * specified time window.
 *
 * Used by the content-generation agent skip-if-fresh precheck (MP-CGA-006).
 *
 * @param tickerId - Ticker id to match.
 * @param windowStart - Start of the time window (inclusive, ISO datetime string).
 * @param windowEnd - End of the time window (exclusive, ISO datetime string).
 * @param db - Database dependency, injectable for tests.
 * @returns Object with `hasNewsletter` flag and optional `newsletterId`.
 */
export const getLatestNewsletter = async (
  tickerId: string,
  windowStart: string,
  windowEnd: string,
  db: Pick<ContentGenerationDb, "newsletter"> = prisma,
): Promise<{ hasNewsletter: boolean; newsletterId: string | null }> => {
  const newsletter = await db.newsletter.findFirst({
    where: {
      tickerId,
      createdAt: {
        gte: new Date(windowStart),
        lt: new Date(windowEnd),
      },
    },
    select: { id: true },
    orderBy: { createdAt: "desc" },
  });

  return {
    hasNewsletter: newsletter !== null,
    newsletterId: newsletter?.id ?? null,
  };
};

/**
 * Lists recent newsletter subjects for a ticker (novelty scoring in content-generation).
 *
 * @param tickerId - Ticker id to match.
 * @param days - Lookback window in calendar days.
 * @param db - Database dependency, injectable for tests.
 */
export const getRecentNewsletterSubjects = async (
  tickerId: string,
  days: number,
  db: Pick<ContentGenerationDb, "newsletter"> = prisma,
): Promise<{
  items: Array<{ subject: string; createdAt: string }>;
}> => {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);

  const findArgs = {
    where: {
      tickerId,
      createdAt: { gte: since },
    },
    select: { subject: true, createdAt: true },
    orderBy: { createdAt: "desc" as const },
  } satisfies Prisma.NewsletterFindManyArgs;

  const rows = await db.newsletter.findMany(findArgs);

  return {
    items: rows.map((row) => ({
      subject: row.subject,
      createdAt: row.createdAt.toISOString(),
    })),
  };
};

/**
 * Lists flattened bullets from recent newsletter wire bodies for cross-run dedup.
 *
 * @param tickerId - Ticker id to match.
 * @param days - Lookback window in calendar days.
 * @param db - Database dependency, injectable for tests.
 */
export const getRecentNewsletterBullets = async (
  tickerId: string,
  days: number,
  db: Pick<ContentGenerationDb, "newsletter"> = prisma,
): Promise<{
  items: Array<{
    newsletterId: string;
    sectionKey: string;
    bulletText: string;
    createdAt: string;
  }>;
}> => {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);

  const findArgs = {
    where: {
      tickerId,
      createdAt: { gte: since },
    },
    select: { id: true, content: true, createdAt: true },
    orderBy: { createdAt: "desc" as const },
  } satisfies Prisma.NewsletterFindManyArgs;

  const rows = await db.newsletter.findMany(findArgs);
  const items: Array<{
    newsletterId: string;
    sectionKey: string;
    bulletText: string;
    createdAt: string;
  }> = [];

  for (const row of rows) {
    const flattened = flattenBulletsFromNewsletterDocument(
      row.id,
      row.content,
      row.createdAt.toISOString(),
    );
    for (const bullet of flattened) {
      items.push(bullet);
      if (items.length >= MAX_RECENT_BULLETS) {
        return { items };
      }
    }
  }

  return { items };
};
