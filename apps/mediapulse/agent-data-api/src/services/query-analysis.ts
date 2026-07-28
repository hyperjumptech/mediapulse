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

type QueryAnalysisDb = {
  ticker: Pick<typeof prisma.ticker, "findUniqueOrThrow">;
  searchQuerySet: Pick<
    typeof prisma.searchQuerySet,
    "updateMany" | "create" | "update" | "findUnique" | "delete"
  >;
  searchQuery: Pick<typeof prisma.searchQuery, "deleteMany" | "createMany">;
};

const defaultDb: QueryAnalysisDb = {
  ticker: prisma.ticker,
  searchQuerySet: prisma.searchQuerySet,
  searchQuery: prisma.searchQuery,
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
