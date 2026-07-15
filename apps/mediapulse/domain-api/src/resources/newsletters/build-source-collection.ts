import type { Prisma, prisma } from "@mediapulse/database";

import {
  classifyCollectionSource,
  COLLECTION_SOURCE_LABEL,
} from "../data-sources/collection-source";

const STAGE_TIMEZONE = "Asia/Jakarta";

/** Shape of one collected-source entry in the source-collection stage payload. */
export type SourceCollectionEntryPayload = {
  id: string;
  title: string;
  url: string;
  collectorLabel: string;
  meta: string;
};

/** Shape of the source-collection stage payload exposed by the detail handler. */
export type SourceCollectionPayload = {
  totalLabel: string;
  dataCollectionLabel: string;
  pageCollectionLabel: string;
  publishersLabel: string;
  sources: SourceCollectionEntryPayload[];
};

/** Prisma collaborator surface for {@link buildSourceCollection}. */
export type BuildSourceCollectionDeps = {
  newsletterCitation: Pick<typeof prisma.newsletterCitation, "findMany">;
};

const publisherFromUrl = (url: string): string | undefined => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }
};

const formatCollectedAt = (date: Date): string =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: STAGE_TIMEZONE,
  }).format(date);

/**
 * Collects the distinct sources a newsletter cited, bucketed by the collector that produced each one
 * (data-collection when the source carries a search query, page-collection otherwise), for the source
 * collection stage panel. Reads the exact `newsletter_citation` join, so counts reflect only the
 * sources this newsletter actually used rather than the ticker's wider collection funnel.
 *
 * Sources are deduplicated by id (a source cited in several sections counts once) and ordered by
 * collector then title.
 *
 * @param newsletterId - Newsletter whose cited sources to collect.
 * @param deps - Prisma `newsletterCitation` delegate.
 * @returns The stage KPIs and the ordered list of cited sources.
 */
export const buildSourceCollection = async (
  newsletterId: string,
  deps: BuildSourceCollectionDeps,
): Promise<SourceCollectionPayload> => {
  const findManyArgs = {
    where: { newsletterId },
    include: {
      dataSource: {
        select: {
          id: true,
          url: true,
          title: true,
          source: true,
          fetchedAt: true,
          createdAt: true,
          searchQueryId: true,
        },
      },
    },
  } satisfies Prisma.NewsletterCitationFindManyArgs;

  const rows = await deps.newsletterCitation.findMany(findManyArgs);

  type CitationRow = Prisma.NewsletterCitationGetPayload<typeof findManyArgs>;

  const uniqueSources = new Map<string, CitationRow["dataSource"]>();
  for (const row of rows as CitationRow[]) {
    if (!uniqueSources.has(row.dataSource.id)) {
      uniqueSources.set(row.dataSource.id, row.dataSource);
    }
  }

  let dataCollectionCount = 0;
  let pageCollectionCount = 0;
  const publishers = new Set<string>();

  const sources = [...uniqueSources.values()].map((dataSource) => {
    const collectionSource = classifyCollectionSource(
      dataSource.searchQueryId !== null,
    );
    if (collectionSource === "data-collection") {
      dataCollectionCount += 1;
    } else {
      pageCollectionCount += 1;
    }

    const publisher =
      dataSource.source && dataSource.source.length > 0
        ? dataSource.source
        : publisherFromUrl(dataSource.url);
    if (publisher) {
      publishers.add(publisher.toLowerCase());
    }

    const collectedAt = dataSource.fetchedAt ?? dataSource.createdAt;
    const meta = [publisher, formatCollectedAt(collectedAt)]
      .filter((part): part is string => Boolean(part))
      .join(" · ");

    return {
      id: dataSource.id,
      title: dataSource.title,
      url: dataSource.url,
      collectorLabel: COLLECTION_SOURCE_LABEL[collectionSource],
      meta,
    } satisfies SourceCollectionEntryPayload;
  });

  sources.sort((left, right) => {
    if (left.collectorLabel !== right.collectorLabel) {
      return left.collectorLabel.localeCompare(right.collectorLabel);
    }

    return left.title.localeCompare(right.title);
  });

  return {
    totalLabel: sources.length.toLocaleString("en-US"),
    dataCollectionLabel: dataCollectionCount.toLocaleString("en-US"),
    pageCollectionLabel: pageCollectionCount.toLocaleString("en-US"),
    publishersLabel: publishers.size.toLocaleString("en-US"),
    sources,
  };
};
