import { prisma } from "@mediapulse/database";
import { logger } from "@workspace/logger";
import type { PostContentGenerationBody } from "@workspace/agent-data-api-contract";

import type { Prisma } from "@mediapulse/database";

import { flattenBulletsFromNewsletterWire } from "../lib/flatten-newsletter-wire-bullets.js";

const MAX_RECENT_BULLETS = 200;
const MAX_COMPETITOR_EDGE_FETCH = 50;
const MAX_COMPETITORS_DEFAULT = 8;

type DataSourceWithScore = Prisma.DataSourceGetPayload<{
  include: {
    articleRelevances: {
      select: {
        score: true;
      };
    };
  };
}>;

type ContentGenerationDb = {
  dataSource: Pick<typeof prisma.dataSource, "findMany">;
  ticker: Pick<typeof prisma.ticker, "findUniqueOrThrow" | "findUnique">;
  newsletter: Pick<
    typeof prisma.newsletter,
    "create" | "findFirst" | "findMany"
  >;
  entity: Pick<typeof prisma.entity, "findFirst" | "findMany">;
  entityAlias: Pick<typeof prisma.entityAlias, "findMany">;
  tickerEntity: Pick<typeof prisma.tickerEntity, "findFirst" | "findMany">;
  entityRelation: Pick<typeof prisma.entityRelation, "findMany">;
  relationType: Pick<typeof prisma.relationType, "findMany">;
  entityType: Pick<typeof prisma.entityType, "findFirst">;
};

type IssuerAnchor = {
  entityId: string;
  canonicalName: string;
  aliases: string[];
};

export type CompetitorEntry = {
  name: string;
  aliases: string[];
  relation: string;
  weight: number;
};

const normalizeName = (value: string): string => value.trim().toLowerCase();

async function findIssuerAnchorForTicker(
  tickerId: string,
  db: Pick<ContentGenerationDb, "ticker" | "entityType" | "tickerEntity">,
): Promise<IssuerAnchor | null> {
  const ticker = await db.ticker.findUnique({
    where: { id: tickerId },
    select: { symbol: true, name: true },
  } satisfies Prisma.TickerFindUniqueArgs);
  if (!ticker) return null;

  const companyType = await db.entityType.findFirst({
    where: { name: "COMPANY" },
    select: { id: true },
  } satisfies Prisma.EntityTypeFindFirstArgs);
  if (!companyType) return null;

  const tickerEntityRow = await db.tickerEntity.findFirst({
    where: {
      tickerId,
      source: "SEED",
      entity: { typeId: companyType.id },
    },
    select: {
      entityId: true,
      entity: {
        select: {
          canonicalName: true,
          aliases: { select: { alias: true } },
        },
      },
    },
  } satisfies Prisma.TickerEntityFindFirstArgs);
  if (!tickerEntityRow) return null;

  const storedAliases = tickerEntityRow.entity.aliases.map((row) => row.alias);
  const aliases = [
    ...new Set(
      [ticker.symbol, ticker.name, ...storedAliases].filter(
        (value) => value.length > 0,
      ),
    ),
  ];

  return {
    entityId: tickerEntityRow.entityId,
    canonicalName: tickerEntityRow.entity.canonicalName,
    aliases,
  };
}

/**
 * Reads COMPETITOR and SECTOR_PEER edges from the issuer entity, returning a
 * ranked, capped, self-excluded list of peer COMPANY entities.
 *
 * @param issuerEntityId - KG entity id for the ticker's issuer anchor.
 * @param issuerNormalizedAliasSet - Normalized alias strings for the issuer (self-exclusion guard).
 * @param opts - Optional cap override.
 * @param db - Database delegates.
 * @returns Competitor entries ordered by weight desc, then lastSeenAt desc.
 */
export async function getCompetitorsForTicker(
  issuerEntityId: string,
  issuerNormalizedAliasSet: ReadonlySet<string>,
  opts: { maxCompetitors?: number },
  db: Pick<ContentGenerationDb, "entityRelation">,
): Promise<CompetitorEntry[]> {
  const maxCompetitors = opts.maxCompetitors ?? MAX_COMPETITORS_DEFAULT;

  const relations = await db.entityRelation.findMany({
    where: {
      OR: [{ fromEntityId: issuerEntityId }, { toEntityId: issuerEntityId }],
      relationType: {
        name: { in: ["COMPETITOR", "SECTOR_PEER"] },
      },
    },
    select: {
      fromEntityId: true,
      toEntityId: true,
      weight: true,
      relationType: { select: { name: true } },
      fromEntity: {
        select: {
          id: true,
          canonicalName: true,
          type: { select: { name: true } },
          aliases: { select: { alias: true } },
        },
      },
      toEntity: {
        select: {
          id: true,
          canonicalName: true,
          type: { select: { name: true } },
          aliases: { select: { alias: true } },
        },
      },
    },
    orderBy: [{ weight: "desc" }, { lastSeenAt: "desc" }],
    take: MAX_COMPETITOR_EDGE_FETCH,
  } satisfies Prisma.EntityRelationFindManyArgs);

  const seenEntityIds = new Set<string>();
  const competitors: CompetitorEntry[] = [];

  for (const relation of relations) {
    if (competitors.length >= maxCompetitors) break;

    const peerEntity =
      relation.fromEntityId === issuerEntityId
        ? relation.toEntity
        : relation.fromEntity;

    if (peerEntity.type.name !== "COMPANY") continue;
    if (peerEntity.id === issuerEntityId) continue;

    const peerNormalizedName = normalizeName(peerEntity.canonicalName);
    if (issuerNormalizedAliasSet.has(peerNormalizedName)) continue;
    const peerNormalizedAliases = peerEntity.aliases.map((aliasRow) =>
      normalizeName(aliasRow.alias),
    );
    if (
      peerNormalizedAliases.some((alias) => issuerNormalizedAliasSet.has(alias))
    )
      continue;

    if (seenEntityIds.has(peerEntity.id)) continue;
    seenEntityIds.add(peerEntity.id);

    competitors.push({
      name: peerEntity.canonicalName,
      aliases: peerEntity.aliases.map((aliasRow) => aliasRow.alias),
      relation: relation.relationType.name,
      weight: relation.weight,
    });
  }

  return competitors;
}

/**
 * Returns today's selected data sources for a ticker, plus the ticker's
 * human-readable name and exchange symbol, ordered by relevance score.
 *
 * @param tickerId - Ticker id used to scope data sources and relevance rows.
 * @param deps - Optional dependencies for database and current time.
 * @returns Data sources filtered to selected article relevance rows scored today (UTC), plus `tickerName` and `tickerSymbol`.
 */
export const getDataSourcesForTicker = async (
  tickerId: string,
  deps: {
    db?: Pick<
      ContentGenerationDb,
      "dataSource" | "ticker" | "entityType" | "tickerEntity" | "entityRelation"
    >;
    now?: () => Date;
  } = {},
) => {
  const { db = prisma, now = () => new Date() } = deps;
  const startOfTodayUtc = now();
  startOfTodayUtc.setUTCHours(0, 0, 0, 0);

  const [ticker, dataSourcesWithScores] = await Promise.all([
    db.ticker.findUniqueOrThrow({
      where: { id: tickerId },
      select: { symbol: true, name: true },
    } satisfies Prisma.TickerFindUniqueOrThrowArgs),
    db.dataSource.findMany({
      where: {
        tickerId,
        articleRelevances: {
          some: {
            tickerId,
            selected: true,
            scoredAt: { gte: startOfTodayUtc },
          },
        },
      },
      include: {
        articleRelevances: {
          where: {
            tickerId,
            selected: true,
            scoredAt: { gte: startOfTodayUtc },
          },
          select: {
            score: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    } satisfies Prisma.DataSourceFindManyArgs),
  ]);

  const dataSources = dataSourcesWithScores
    .sort((left: DataSourceWithScore, right: DataSourceWithScore) => {
      const leftScore = left.articleRelevances[0]?.score ?? 0;
      const rightScore = right.articleRelevances[0]?.score ?? 0;
      return rightScore - leftScore;
    })
    .map(
      ({
        articleRelevances: _articleRelevances,
        ...dataSource
      }: DataSourceWithScore) => dataSource,
    );

  const anchor = await findIssuerAnchorForTicker(tickerId, db);
  const issuerAliases: string[] =
    anchor?.aliases ??
    [ticker.symbol, ticker.name].filter((value) => value.length > 0);
  const competitorEntries = anchor
    ? await getCompetitorsForTicker(
        anchor.entityId,
        new Set(issuerAliases.map(normalizeName)),
        {},
        db,
      )
    : [];
  const competitors = competitorEntries.map((entry) => ({
    name: entry.name,
    relation: entry.relation,
  }));

  return {
    dataSources,
    tickerSymbol: ticker.symbol,
    tickerName: ticker.name,
    competitors,
    issuerAliases,
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
  db: Pick<ContentGenerationDb, "newsletter"> = prisma,
) => {
  const newsletter = await db.newsletter.create({
    data: {
      subject: data.subject,
      description: data.description ?? null,
      content: data.content,
      tickerId: data.tickerId,
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
    const flattened = flattenBulletsFromNewsletterWire(
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
