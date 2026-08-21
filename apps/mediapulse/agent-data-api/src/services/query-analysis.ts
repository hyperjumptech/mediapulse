import { prisma, type Prisma } from "@mediapulse/database";
import { createSearchQuerySet } from "@mediapulse/domain-api/search-query-set-persist";
import type {
  GetQueryAnalysisQuery,
  PostQueryAnalysisBody,
} from "@workspace/agent-data-api-contract";

type ProfileParty = { name: string; aliases: string[] };

const parseParties = (value: unknown): ProfileParty[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const parties: ProfileParty[] = [];
  for (const entry of value) {
    if (entry === null || typeof entry !== "object") {
      continue;
    }
    const candidate = entry as { name?: unknown; aliases?: unknown };
    if (typeof candidate.name !== "string" || candidate.name.trim() === "") {
      continue;
    }
    const aliases = Array.isArray(candidate.aliases)
      ? candidate.aliases.filter(
          (alias): alias is string => typeof alias === "string",
        )
      : [];
    parties.push({ name: candidate.name, aliases });
  }

  return parties;
};

/**
 * How far back a query's novel-article history is read when deciding whether it has proven itself.
 */
const PROVEN_QUERY_LOOKBACK_DAYS = 30;

/** Most proven queries returned, so a set is seeded rather than fully dictated by history. */
const PROVEN_QUERY_LIMIT = 12;

type QueryAnalysisDb = {
  ticker: Pick<typeof prisma.ticker, "findUniqueOrThrow">;
  searchQuerySet: Pick<
    typeof prisma.searchQuerySet,
    "updateMany" | "create" | "update" | "findUnique" | "delete"
  >;
  searchQuery: Pick<
    typeof prisma.searchQuery,
    "deleteMany" | "createMany" | "findMany"
  >;
};

const defaultDb: QueryAnalysisDb = {
  ticker: prisma.ticker,
  searchQuerySet: prisma.searchQuerySet,
  searchQuery: prisma.searchQuery,
};

/**
 * Query texts for a ticker that produced novel articles recently, strongest first.
 *
 * Query sets are regenerated every run, so a query text survives roughly two sets and its yield
 * history is discarded before it can inform anything. Reading history by text rather than by row
 * lets a phrasing that worked be carried into the next set instead of being regenerated from
 * scratch.
 *
 * @param tickerId - Ticker whose query history is read.
 * @param db - Optional injected DB delegates for testing.
 * @param now - Reference time, injectable for testing.
 * @returns Distinct query texts ranked by novel articles produced, capped at
 *   {@link PROVEN_QUERY_LIMIT}.
 */
export const getProvenQueries = async (
  tickerId: string,
  db: {
    searchQuery: Pick<typeof prisma.searchQuery, "findMany">;
  } = defaultDb,
  now: () => Date = () => new Date(),
) => {
  const since = new Date(
    now().getTime() - PROVEN_QUERY_LOOKBACK_DAYS * 86_400_000,
  );
  const rows = (await db.searchQuery.findMany({
    where: {
      tickerId,
      searchQueryYields: { some: { runDate: { gte: since } } },
    },
    select: {
      text: true,
      intent: true,
      searchQueryYields: {
        where: { runDate: { gte: since } },
        select: { novelArticleCount: true },
      },
    },
  } satisfies Prisma.SearchQueryFindManyArgs)) as {
    text: string;
    intent: string;
    searchQueryYields?: { novelArticleCount: number }[];
  }[];

  const byText = new Map<
    string,
    { text: string; intent: string; novelArticleCount: number }
  >();
  for (const row of rows) {
    const novel = (row.searchQueryYields ?? []).reduce(
      (total, entry) => total + entry.novelArticleCount,
      0,
    );
    if (novel <= 0) {
      continue;
    }
    const key = row.text.trim().toLowerCase();
    const existing = byText.get(key);
    if (existing === undefined) {
      byText.set(key, {
        text: row.text,
        intent: row.intent,
        novelArticleCount: novel,
      });
      continue;
    }
    existing.novelArticleCount += novel;
  }

  return [...byText.values()]
    .sort((first, second) =>
      second.novelArticleCount === first.novelArticleCount
        ? first.text.localeCompare(second.text)
        : second.novelArticleCount - first.novelArticleCount,
    )
    .slice(0, PROVEN_QUERY_LIMIT);
};

/**
 * Builds query-analysis GET response data for one ticker.
 *
 * @param query - Validated query payload containing `tickerId`.
 * @param db - Optional injected DB delegates for testing.
 * @returns The ticker with its classification columns.
 */
export const getQueryAnalysisContext = async (
  query: GetQueryAnalysisQuery,
  db: QueryAnalysisDb = defaultDb,
) => {
  const provenQueries = await getProvenQueries(query.tickerId, db);
  const ticker = await db.ticker.findUniqueOrThrow({
    where: { id: query.tickerId },
    select: {
      id: true,
      symbol: true,
      name: true,
      aliases: true,
      sector: true,
      industry: true,
      subSector: true,
      subIndustry: true,
      businessActivity: true,
      profile: {
        select: {
          companyOverview: true,
          businessOperation: true,
          sectorIndonesian: true,
          sectorEnglish: true,
          subSectorIndonesian: true,
          subSectorEnglish: true,
          industryIndonesian: true,
          industryEnglish: true,
          subIndustryIndonesian: true,
          subIndustryEnglish: true,
          aliases: true,
          competitors: true,
          regulators: true,
        },
      },
    },
  } satisfies Prisma.TickerFindUniqueOrThrowArgs);

  const profile = ticker.profile;

  return {
    provenQueries,
    ticker: {
      id: ticker.id,
      symbol: ticker.symbol,
      name: ticker.name,
      aliases: ticker.aliases,
      sector: ticker.sector,
      industry: ticker.industry,
      subSector: ticker.subSector,
      subIndustry: ticker.subIndustry,
      businessActivity: ticker.businessActivity,
    },
    profile:
      profile === null || profile === undefined
        ? null
        : {
            companyOverview: profile.companyOverview,
            businessOperation: profile.businessOperation,
            sector: {
              indonesian: profile.sectorIndonesian,
              english: profile.sectorEnglish,
            },
            subSector: {
              indonesian: profile.subSectorIndonesian,
              english: profile.subSectorEnglish,
            },
            industry: {
              indonesian: profile.industryIndonesian,
              english: profile.industryEnglish,
            },
            subIndustry: {
              indonesian: profile.subIndustryIndonesian,
              english: profile.subIndustryEnglish,
            },
            aliases: profile.aliases,
            competitors: parseParties(profile.competitors),
            regulators: parseParties(profile.regulators),
          },
  };
};

/**
 * Persists and activates a new query set for the provided ticker.
 *
 * @param body - Validated POST payload with generated queries and metadata.
 * @param db - Optional injected DB delegates for testing.
 * @returns Created query count and active set identifiers.
 */
export const createAndActivateQuerySet = async (
  body: PostQueryAnalysisBody,
  db: QueryAnalysisDb = defaultDb,
) => {
  const { id, queryCount } = await createSearchQuerySet(
    {
      tickerId: body.tickerId,
      isActive: body.activate,
      generationSource: body.generationSource,
      strategySnapshot: body.strategySnapshot,
      agentJobId: body.agentJobId,
      agentId: body.agentId,
      agentVersion: body.agentVersion,
      queries: body.queries,
    },
    db,
  );

  return {
    created: queryCount,
    createdSetId: id,
    activeSetId: id,
  };
};
