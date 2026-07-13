import type {
  AnalysisTickerContext,
  GetAnalysisQuery,
  GetAnalysisResponse,
  PostAnalysisDataSourceDeleteBody,
  PostAnalysisBody,
  PostAnalysisResponse,
} from "@workspace/agent-data-api-contract";
import { prisma, Prisma } from "@mediapulse/database";

import {
  extractTickerBusinessContext,
  extractTickerSectorIndustry,
} from "./query-analysis-context-helpers.js";
import {
  findIssuerAnchorForTicker,
  getCompetitorsForTicker,
  normalizeName,
} from "./issuer-context.js";

/** Newest-first cap on eligible articles scanned per candidate-pair request. */
const MAX_CANDIDATE_ARTICLE_SCAN = 1500;
/** Only articles created within this window are considered for candidate pairs. */
const CANDIDATE_ARTICLE_RECENCY_DAYS = 3;
/** Per-(article, ticker) section upserts committed per transaction, to stay under the timeout. */
const SECTION_UPSERT_CHUNK_SIZE = 20;
const ACCEPTED_CAP_PER_TICKER = 50;

/**
 * Thrown when the analysis POST body references data sources or tickers that do not exist.
 */
export class AnalysisPostValidationError extends Error {
  /**
   * @param message - Human-readable validation message.
   */
  constructor(message: string) {
    super(message);
    this.name = "AnalysisPostValidationError";
  }
}

type AnalysisDb = {
  dataSource: Pick<
    typeof prisma.dataSource,
    "findMany" | "count" | "update" | "updateMany" | "deleteMany"
  >;
  dataSourceTickerSection: Pick<
    typeof prisma.dataSourceTickerSection,
    "upsert" | "count"
  >;
  ticker: Pick<typeof prisma.ticker, "findMany" | "findUnique" | "findFirst">;
  searchQuerySet: Pick<typeof prisma.searchQuerySet, "findMany">;
  entityType: Pick<typeof prisma.entityType, "findFirst">;
  tickerEntity: Pick<typeof prisma.tickerEntity, "findFirst">;
  entityRelation: Pick<typeof prisma.entityRelation, "findMany">;
  $transaction: typeof prisma.$transaction;
};

const defaultDb: AnalysisDb = prisma;

const countAcceptedSections = (
  tickerId: string,
  db: Pick<AnalysisDb, "dataSourceTickerSection">,
): Promise<number> =>
  db.dataSourceTickerSection.count({
    where: { tickerId, section: { not: null } },
  } satisfies Prisma.DataSourceTickerSectionCountArgs);

const computeCappedTickerIds = async (
  tickerIds: string[],
  cap: number,
  db: Pick<AnalysisDb, "dataSourceTickerSection">,
): Promise<Set<string>> => {
  const entries = await Promise.all(
    tickerIds.map(async (tickerId) => {
      const accepted = await countAcceptedSections(tickerId, db);

      return [tickerId, accepted] as const;
    }),
  );

  return new Set(
    entries
      .filter(([, accepted]) => accepted >= cap)
      .map(([tickerId]) => tickerId),
  );
};

type TickerRow = {
  symbol: string;
  name: string;
  sector: string | null;
  industry: string | null;
  subSector: string | null;
  subIndustry: string | null;
  businessActivity: string | null;
} | null;

const mapTickerContext = (ticker: TickerRow): AnalysisTickerContext => {
  if (ticker === null) {
    throw new Error("mapTickerContext called with null ticker");
  }
  const { sector, industry } = extractTickerSectorIndustry(ticker);
  const { subIndustry, businessActivity } =
    extractTickerBusinessContext(ticker);

  return {
    symbol: ticker.symbol,
    name: ticker.name,
    sector: sector ?? null,
    industry: industry ?? null,
    subIndustry: subIndustry ?? null,
    businessActivity: businessActivity ?? null,
  };
};

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Compiles a word-boundary matcher over a ticker's issuer + peer aliases. */
const compileAliasMatcher = (aliases: string[]): RegExp | null => {
  const cleaned = [
    ...new Set(aliases.map((alias) => alias.trim()).filter(Boolean)),
  ];
  if (cleaned.length === 0) return null;
  const pattern = cleaned.map(escapeRegExp).join("|");

  return new RegExp(`\\b(${pattern})\\b`, "i");
};

type TickerGatingContext = {
  tickerId: string;
  context: AnalysisTickerContext;
  matcher: RegExp | null;
};

/** Ticker columns selected to build {@link AnalysisTickerContext}. */
const tickerContextSelect = {
  symbol: true,
  name: true,
  sector: true,
  industry: true,
  subSector: true,
  subIndustry: true,
  businessActivity: true,
} satisfies Prisma.TickerSelect;

/** Builds issuer context + alias matcher for one active ticker. */
const buildTickerGatingContext = async (
  ticker: {
    id: string;
    symbol: string;
    name: string;
    sector: string | null;
    industry: string | null;
    subSector: string | null;
    subIndustry: string | null;
    businessActivity: string | null;
  },
  db: Pick<
    AnalysisDb,
    "ticker" | "entityType" | "tickerEntity" | "entityRelation"
  >,
): Promise<TickerGatingContext> => {
  const anchor = await findIssuerAnchorForTicker(ticker.id, db);
  const issuerAliases =
    anchor?.aliases ??
    [ticker.symbol, ticker.name].filter((value) => value.length > 0);
  const competitors = anchor
    ? await getCompetitorsForTicker(
        anchor.entityId,
        new Set(issuerAliases.map(normalizeName)),
        {},
        db,
      )
    : [];
  const aliases = [
    ...issuerAliases,
    ...competitors.map((competitor) => competitor.name),
    ...competitors.flatMap((competitor) => competitor.aliases),
  ];

  return {
    tickerId: ticker.id,
    context: mapTickerContext(ticker),
    matcher: compileAliasMatcher(aliases),
  };
};

/**
 * Builds candidate (article, ticker) pairs for the article-analysis agent.
 *
 * Curated articles (gated, ticker-agnostic) fan out to active tickers whose issuer/peer aliases
 * the article mentions. Search-query articles pair against their own ticker. Pairs already present
 * in `data_source_ticker_section` are skipped.
 */
const buildAnalysisCandidatePairs = async (
  query: GetAnalysisQuery,
  db: Pick<
    AnalysisDb,
    | "dataSource"
    | "dataSourceTickerSection"
    | "ticker"
    | "searchQuerySet"
    | "entityType"
    | "tickerEntity"
    | "entityRelation"
  >,
): Promise<GetAnalysisResponse> => {
  const recencyFloor = new Date(
    Date.now() - CANDIDATE_ARTICLE_RECENCY_DAYS * 24 * 60 * 60 * 1000,
  );
  const createdAtWhere =
    query.start !== undefined || query.end !== undefined
      ? ({
          ...(query.start !== undefined ? { gte: new Date(query.start) } : {}),
          ...(query.end !== undefined ? { lte: new Date(query.end) } : {}),
        } satisfies Prisma.DateTimeFilter)
      : ({ gte: recencyFloor } satisfies Prisma.DateTimeFilter);

  const where = {
    OR: [
      { collectionGateStatus: "passed" as const, tickerId: null },
      { tickerId: { not: null } },
    ],
    createdAt: createdAtWhere,
  } satisfies Prisma.DataSourceWhereInput;

  const activeSets = await db.searchQuerySet.findMany({
    where: { isActive: true },
    select: { tickerId: true },
  } satisfies Prisma.SearchQuerySetFindManyArgs);
  const activeTickerIds = [...new Set(activeSets.map((row) => row.tickerId))];

  const cappedTickerIds = await computeCappedTickerIds(
    activeTickerIds,
    ACCEPTED_CAP_PER_TICKER,
    db,
  );

  const activeTickers = await db.ticker.findMany({
    where: { id: { in: activeTickerIds } },
    select: { id: true, ...tickerContextSelect },
  } satisfies Prisma.TickerFindManyArgs);
  const gatingContexts = await Promise.all(
    activeTickers.map((ticker) => buildTickerGatingContext(ticker, db)),
  );

  const articles = await db.dataSource.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: MAX_CANDIDATE_ARTICLE_SCAN,
    select: {
      id: true,
      url: true,
      title: true,
      description: true,
      content: true,
      createdAt: true,
      tickerId: true,
      ticker: { select: tickerContextSelect },
      tickerSections: { select: { tickerId: true } },
    },
  } satisfies Prisma.DataSourceFindManyArgs);

  const pairs: GetAnalysisResponse["dataSources"] = [];

  for (const article of articles) {
    const classifiedTickerIds = new Set(
      article.tickerSections.map((row) => row.tickerId),
    );

    if (article.tickerId !== null) {
      if (classifiedTickerIds.has(article.tickerId)) continue;
      if (cappedTickerIds.has(article.tickerId)) continue;
      pairs.push({
        id: article.id,
        tickerId: article.tickerId,
        url: article.url,
        title: article.title,
        description: article.description,
        content: article.content,
        createdAt: article.createdAt,
        ticker: mapTickerContext(article.ticker),
      });
      continue;
    }

    const haystack = `${article.title}\n${article.description ?? article.content ?? ""}`;
    for (const gating of gatingContexts) {
      if (classifiedTickerIds.has(gating.tickerId)) continue;
      if (cappedTickerIds.has(gating.tickerId)) continue;
      if (gating.matcher === null || !gating.matcher.test(haystack)) continue;
      pairs.push({
        id: article.id,
        tickerId: gating.tickerId,
        url: article.url,
        title: article.title,
        description: article.description,
        content: article.content,
        createdAt: article.createdAt,
        ticker: gating.context,
      });
    }
  }

  return {
    dataSources: query.limit ? pairs.slice(0, query.limit) : pairs,
    dataSourceTotalCount: pairs.length,
  };
};

/**
 * Loads candidate (article, ticker) pairs for the article-analysis agent, or — when scoped to a
 * single ticker — that ticker's article backlog (data-collection daily baseline count).
 *
 * @param query - Parsed GET query (`unanalyzed` defaults to incremental backlog only).
 * @param deps - Injectable database delegates for tests.
 * @returns Eligible (article, ticker) pairs (capped by `limit`) plus the total backlog count.
 */
export const loadAnalysisContext = async (
  query: GetAnalysisQuery,
  deps: { db?: AnalysisDb } = {},
): Promise<GetAnalysisResponse> => {
  const db = deps.db ?? defaultDb;

  if (query.tickerId === undefined) {
    return buildAnalysisCandidatePairs(query, db);
  }

  const scopedTickerId = query.tickerId;
  const createdAtWhere =
    query.start !== undefined || query.end !== undefined
      ? ({
          ...(query.start !== undefined ? { gte: new Date(query.start) } : {}),
          ...(query.end !== undefined ? { lte: new Date(query.end) } : {}),
        } satisfies Prisma.DateTimeFilter)
      : undefined;

  const where = {
    tickerId: scopedTickerId,
    ...(createdAtWhere ? { createdAt: createdAtWhere } : {}),
    ...(query.unanalyzed ? { analyzedAt: null } : {}),
  } satisfies Prisma.DataSourceWhereInput;

  const [rows, dataSourceTotalCount] = await Promise.all([
    db.dataSource.findMany({
      where,
      orderBy: { createdAt: "asc" },
      ...(query.limit ? { take: query.limit } : {}),
      select: {
        id: true,
        url: true,
        title: true,
        description: true,
        content: true,
        createdAt: true,
        tickerId: true,
        ticker: { select: tickerContextSelect },
      },
    } satisfies Prisma.DataSourceFindManyArgs),
    db.dataSource.count({ where }),
  ]);

  const dataSources = rows.map((row) => ({
    id: row.id,
    tickerId: row.tickerId ?? scopedTickerId,
    url: row.url,
    title: row.title,
    description: row.description,
    content: row.content,
    createdAt: row.createdAt,
    ticker: mapTickerContext(row.ticker),
  }));

  return { dataSources, dataSourceTotalCount };
};

/**
 * Persists per-(article, ticker) section classifications and marks the articles analyzed.
 *
 * @param body - Validated analysis POST body (section rows + analyzed ids).
 * @param deps - Injectable database delegates for tests.
 * @returns Counts of scored and rejected (section `null`) pairs.
 * @throws {AnalysisPostValidationError} When a referenced data source does not exist.
 */
export const applyAnalysisPost = async (
  body: PostAnalysisBody,
  deps: { db?: AnalysisDb } = {},
): Promise<PostAnalysisResponse> => {
  const db = deps.db ?? defaultDb;

  const referencedIds = new Set<string>([
    ...body.articleSections.map((row) => row.dataSourceId),
    ...body.analyzedDataSourceIds,
  ]);

  if (referencedIds.size > 0) {
    const existing = await db.dataSource.findMany({
      where: { id: { in: [...referencedIds] } },
      select: { id: true },
    } satisfies Prisma.DataSourceFindManyArgs);
    const existingIds = new Set(existing.map((row) => row.id));
    const missing = [...referencedIds].filter((id) => !existingIds.has(id));
    if (missing.length > 0) {
      throw new AnalysisPostValidationError(
        `Unknown data source ids: ${missing.join(", ")}`,
      );
    }
  }

  const analyzedAt = new Date();
  const sectionWrites: Prisma.PrismaPromise<unknown>[] =
    body.articleSections.map((row) => {
      // Nullable Json column: write SQL NULL when the poster omits the breakdown.
      const sectionScoreBreakdown:
        | Prisma.InputJsonValue
        | typeof Prisma.DbNull =
        row.scoreBreakdown === undefined
          ? Prisma.DbNull
          : (row.scoreBreakdown as unknown as Prisma.InputJsonValue);

      return db.dataSourceTickerSection.upsert({
        where: {
          dataSourceId_tickerId: {
            dataSourceId: row.dataSourceId,
            tickerId: row.tickerId,
          },
        },
        create: {
          dataSourceId: row.dataSourceId,
          tickerId: row.tickerId,
          section: row.section,
          sectionScore: row.score,
          sectionReason: row.reason,
          sectionScoreBreakdown,
          analyzedAt,
        },
        update: {
          section: row.section,
          sectionScore: row.score,
          sectionReason: row.reason,
          sectionScoreBreakdown,
          analyzedAt,
        },
      } satisfies Prisma.DataSourceTickerSectionUpsertArgs);
    });

  // Persist section classifications in bounded transactions. A whole batch of
  // sequential upserts in one transaction overruns the default 5s transaction
  // timeout on a pooled connection; smaller chunks stay well under it.
  for (
    let start = 0;
    start < sectionWrites.length;
    start += SECTION_UPSERT_CHUNK_SIZE
  ) {
    const chunk = sectionWrites.slice(start, start + SECTION_UPSERT_CHUNK_SIZE);
    await db.$transaction(chunk);
  }

  // Mark articles analyzed only after every section row is persisted, so the
  // content-generation read never sees an analyzed article without its sections.
  if (body.analyzedDataSourceIds.length > 0) {
    await db.dataSource.updateMany({
      where: { id: { in: body.analyzedDataSourceIds } },
      data: { analyzedAt },
    });
  }

  const referencedTickerIds = [
    ...new Set(body.articleSections.map((row) => row.tickerId)),
  ];
  const cappedTickerIds = await computeCappedTickerIds(
    referencedTickerIds,
    ACCEPTED_CAP_PER_TICKER,
    db,
  );

  let skippedByCap = 0;
  for (const tickerId of cappedTickerIds) {
    const result = await db.dataSource
      .deleteMany({
        where: { tickerId, analyzedAt: null },
      } satisfies Prisma.DataSourceDeleteManyArgs)
      .catch(() => undefined);
    if (result === undefined) continue;
    skippedByCap += result.count;
  }

  const articlesRejected = body.articleSections.filter(
    (row) => row.section === null,
  ).length;

  return {
    articlesScored: body.articleSections.length,
    articlesRejected,
    skippedByCap,
    cappedTickerCount: cappedTickerIds.size,
  };
};

/**
 * Hard-deletes a data source (used by the analysis data-source delete route).
 *
 * @param body - Delete request body (data source id + ticker scope).
 * @param deps - Injectable database delegates for tests.
 * @returns Whether a row was deleted.
 */
export const deleteAnalysisDataSource = async (
  body: PostAnalysisDataSourceDeleteBody,
  deps: { db?: Pick<AnalysisDb, "dataSource"> } = {},
): Promise<{ deleted: boolean }> => {
  const db = deps.db ?? defaultDb;
  const result = await db.dataSource.deleteMany({
    where: {
      id: body.dataSourceId,
      tickerId: body.tickerId,
    },
  });
  return {
    deleted: result.count > 0,
  };
};
