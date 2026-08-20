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
 * - Important: staleness is not this window's job. `dropStaleForSection` applies each section's own
 *   age ceiling and `crossRunDedup` suppresses stories already covered, so widening here enlarges
 *   the candidate pool without shipping material a section considers old.
 *
 * Article-analysis runs at ~21:00 and content-generation at ~00:03, so a 24h window leaves under
 * four hours of margin: an article analysed at 21:04 is 27 hours old by the next night's run and
 * was dropped, letting re-analysis timing decide editorial outcomes. On 2026-08-20 that held back
 * 34 accepted articles from TLKM, which shipped two items, and 15 from EXCL, each band containing a
 * 1.00-scored article. 48h covers two analysis cycles so one late or retried batch cannot silently
 * empty a newsletter.
 */
const SOURCE_LOOKBACK_HOURS = 48;

type ContentGenerationDb = {
  dataSource: Pick<typeof prisma.dataSource, "update" | "updateMany">;
  dataSourceTickerSection: Pick<
    typeof prisma.dataSourceTickerSection,
    "findMany" | "count"
  >;
  ticker: Pick<typeof prisma.ticker, "findUniqueOrThrow" | "findUnique">;
  newsletter: Pick<
    typeof prisma.newsletter,
    "create" | "findFirst" | "findMany"
  >;
  searchQuerySet: Pick<typeof prisma.searchQuerySet, "findFirst">;
  userTicker: Pick<typeof prisma.userTicker, "findMany">;
  domainAuthority: Pick<typeof prisma.domainAuthority, "findMany">;
};

/**
 * Returns the recently classified data sources for a ticker, plus the ticker's name, symbol,
 * competitors, and issuer aliases. Reads the per-(article, ticker) section table.
 *
 * Sources are selected with a rolling ``SOURCE_LOOKBACK_HOURS`` window (`analyzedAt >= now - lookback`)
 * so two full collect→analyze cycles are visible, rather than the ~2h a UTC-calendar-day boundary
 * would yield.
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
      "dataSourceTickerSection" | "ticker" | "userTicker" | "domainAuthority"
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
            registrableDomain: true,
            searchQueryId: true,
            metadata: true,
            publishedAt: true,
          },
        },
      },
      orderBy: { sectionScore: "desc" },
    } satisfies Prisma.DataSourceTickerSectionFindManyArgs),
  ]);

  const registrableDomains = [
    ...new Set(
      sectionRows
        .map((row) => row.dataSource.registrableDomain)
        .filter((domain): domain is string => domain !== null),
    ),
  ];
  const authorityRows =
    registrableDomains.length === 0
      ? []
      : await db.domainAuthority.findMany({
          where: { domain: { in: registrableDomains } },
          select: { domain: true, openPageRank: true },
        } satisfies Prisma.DomainAuthorityFindManyArgs);
  const authorityByDomain = new Map(
    authorityRows.map((row) => [row.domain, row.openPageRank]),
  );

  const dataSources = sectionRows.map((row) => ({
    dataSourceId: row.dataSource.id,
    url: row.dataSource.url,
    title: row.dataSource.title,
    description: row.dataSource.description,
    content: row.dataSource.content,
    author: row.dataSource.author,
    source: row.dataSource.source,
    registrableDomain: row.dataSource.registrableDomain,
    publisherAuthority:
      row.dataSource.registrableDomain === null
        ? null
        : (authorityByDomain.get(row.dataSource.registrableDomain) ?? null),
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
      if (item.publishedAt !== undefined) {
        await db.dataSource.updateMany({
          where: { id: item.dataSourceId, publishedAt: null },
          data: { publishedAt: new Date(item.publishedAt) },
        } satisfies Prisma.DataSourceUpdateManyArgs);
      }
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
 * Also reports how many sections were classified for the ticker after that newsletter was written.
 * A skip with a non-zero count discards analysis the newsletter never saw, which the agent records
 * under a distinct outcome so the loss is visible rather than silent.
 *
 * @param tickerId - Ticker id to match.
 * @param windowStart - Start of the time window (inclusive, ISO datetime string).
 * @param windowEnd - End of the time window (exclusive, ISO datetime string).
 * @param db - Database dependency, injectable for tests.
 * @returns Whether a newsletter exists, its id and creation time, and the count of later sections.
 */
export const getLatestNewsletter = async (
  tickerId: string,
  windowStart: string,
  windowEnd: string,
  db: Pick<
    ContentGenerationDb,
    "newsletter" | "dataSourceTickerSection"
  > = prisma,
): Promise<{
  hasNewsletter: boolean;
  newsletterId: string | null;
  newsletterCreatedAt: string | null;
  analyzedSinceCount: number;
}> => {
  const newsletter = await db.newsletter.findFirst({
    where: {
      tickerId,
      createdAt: {
        gte: new Date(windowStart),
        lt: new Date(windowEnd),
      },
    },
    select: { id: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  if (newsletter === null) {
    return {
      hasNewsletter: false,
      newsletterId: null,
      newsletterCreatedAt: null,
      analyzedSinceCount: 0,
    };
  }

  const analyzedSinceCount = await db.dataSourceTickerSection.count({
    where: {
      tickerId,
      section: { not: null },
      analyzedAt: { gt: newsletter.createdAt },
    },
  } satisfies Prisma.DataSourceTickerSectionCountArgs);

  return {
    hasNewsletter: true,
    newsletterId: newsletter.id,
    newsletterCreatedAt: newsletter.createdAt.toISOString(),
    analyzedSinceCount,
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
