import type { Prisma, prisma } from "@mediapulse/database";

import {
  classifyCollectionSource,
  COLLECTION_SOURCE_LABEL,
  type CollectionSource,
} from "../data-sources/collection-source";
import { buildSelectedSourcesWindow } from "./selected-sources-window";

/** Shape of one selected-source entry in the detail payload. */
export type SelectedSourcePayload = {
  id: string;
  url: string;
  title: string;
  score: number;
  scoredAt: string;
  searchQueryId: string;
  collectionSource: CollectionSource;
  collectionSourceLabel: string;
};

/** Output of {@link buildSelectedSources}. */
export type BuildSelectedSourcesResult = {
  windowStart: string;
  windowEnd: string;
  sources: SelectedSourcePayload[];
};

/** Prisma collaborator surface for {@link buildSelectedSources}. */
export type BuildSelectedSourcesDeps = {
  dataSource: Pick<typeof prisma.dataSource, "findMany">;
};

/**
 * Collects DataSources selected for the ticker during the same UTC calendar
 * day as the newsletter's `createdAt`, mirroring the window used by the
 * content-generation agent (`getDataSourcesForTicker`).
 *
 * The result is sorted by descending relevance score (highest-scoring first),
 * with ties broken by `scoredAt` descending.
 *
 * @param newsletterId - Caller can use this for logging; the helper itself
 *   doesn't filter on it (the window is per-day, not per-newsletter).
 * @param tickerId - Ticker the newsletter belongs to.
 * @param newsletterCreatedAt - Newsletter's `createdAt` (defines the window).
 * @param deps - Prisma `dataSource` delegate.
 * @returns Window boundaries and the ordered list of selected sources.
 */
export const buildSelectedSources = async (
  _newsletterId: string,
  tickerId: string,
  newsletterCreatedAt: Date,
  deps: BuildSelectedSourcesDeps,
): Promise<BuildSelectedSourcesResult> => {
  const { windowStart, windowEnd, windowStartIso, windowEndIso } =
    buildSelectedSourcesWindow(newsletterCreatedAt);

  const findManyArgs = {
    where: {
      tickerId,
      articleRelevances: {
        some: {
          tickerId,
          selected: true,
          scoredAt: { gte: windowStart, lt: windowEnd },
        },
      },
    },
    include: {
      articleRelevances: {
        where: {
          tickerId,
          selected: true,
          scoredAt: { gte: windowStart, lt: windowEnd },
        },
        select: { score: true, scoredAt: true },
      },
      searchQuery: {
        select: { source: true },
      },
    },
  } satisfies Prisma.DataSourceFindManyArgs;

  const rows = await deps.dataSource.findMany(findManyArgs);

  type RowWithScore = Prisma.DataSourceGetPayload<{
    include: {
      articleRelevances: { select: { score: true; scoredAt: true } };
      searchQuery: { select: { source: true } };
    };
  }>;

  const mapped = (rows as RowWithScore[]).map((row) => {
    const relevance = row.articleRelevances[0];
    const collectionSource = row.searchQuery
      ? classifyCollectionSource(row.searchQuery.source)
      : "page-collection";

    return {
      id: row.id,
      url: row.url,
      title: row.title,
      score: relevance?.score ?? 0,
      scoredAt: (relevance?.scoredAt ?? row.createdAt).toISOString(),
      searchQueryId: row.searchQueryId ?? "",
      collectionSource,
      collectionSourceLabel: COLLECTION_SOURCE_LABEL[collectionSource],
    } satisfies SelectedSourcePayload;
  });

  mapped.sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score;
    return right.scoredAt.localeCompare(left.scoredAt);
  });

  return {
    windowStart: windowStartIso,
    windowEnd: windowEndIso,
    sources: mapped,
  };
};
