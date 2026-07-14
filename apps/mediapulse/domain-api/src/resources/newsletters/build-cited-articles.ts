import { MEDIAPULSE_NEWSLETTER_SECTIONS } from "@workspace/agent-data-api-contract";
import type { Prisma, prisma } from "@mediapulse/database";

import {
  classifyCollectionSource,
  type CollectionSource,
} from "../data-sources/collection-source";

/** Label shown in the Query column for sources that did not come from a search query. */
export const CURATED_SOURCE_LABEL = "Curated source" as const;

const SECTION_LABEL_BY_ID = new Map<string, string>(
  MEDIAPULSE_NEWSLETTER_SECTIONS.map((section) => [section.id, section.label]),
);

const SECTION_ORDER_BY_ID = new Map<string, number>(
  MEDIAPULSE_NEWSLETTER_SECTIONS.map((section, index) => [section.id, index]),
);

const sectionLabel = (sectionKey: string): string =>
  SECTION_LABEL_BY_ID.get(sectionKey) ?? sectionKey;

const sectionOrder = (sectionKey: string): number =>
  SECTION_ORDER_BY_ID.get(sectionKey) ?? MEDIAPULSE_NEWSLETTER_SECTIONS.length;

/** Shape of one cited-article entry in the detail payload. */
export type CitedArticlePayload = {
  id: string;
  title: string;
  url: string;
  publishedSectionKey: string;
  publishedSection: string;
  sectionScore: number | null;
  sectionReason: string;
  collectionSource: CollectionSource;
  queryText: string;
  queryLinkTickerId: string;
  classifiedSection: string;
  sectionMismatch: boolean;
};

/** Prisma collaborator surface for {@link buildCitedArticles}. */
export type BuildCitedArticlesDeps = {
  newsletterCitation: Pick<typeof prisma.newsletterCitation, "findMany">;
};

/**
 * Collects the articles cited by a newsletter, joined to the section, score, and reason that
 * article-analysis assigned for this ticker, plus the search query that surfaced each one. Gives a
 * reviewer a straight line from the shipped newsletter back to the query and reasoning behind every
 * citation.
 *
 * Rows are ordered by published newsletter section (canonical display order), then section-fit
 * score descending, then title. When the published section differs from the article-analysis
 * classification, `sectionMismatch` is set and `classifiedSection` carries the original label so a
 * re-placement is visible.
 *
 * @param newsletterId - Newsletter whose citations to collect.
 * @param tickerId - Ticker the newsletter belongs to; scopes the per-ticker section classification.
 * @param deps - Prisma `newsletterCitation` delegate.
 * @returns The ordered list of cited articles.
 */
export const buildCitedArticles = async (
  newsletterId: string,
  tickerId: string,
  deps: BuildCitedArticlesDeps,
): Promise<CitedArticlePayload[]> => {
  const findManyArgs = {
    where: { newsletterId },
    include: {
      dataSource: {
        select: {
          id: true,
          url: true,
          title: true,
          searchQueryId: true,
          searchQuery: { select: { text: true } },
          tickerSections: {
            where: { tickerId },
            select: { section: true, sectionScore: true, sectionReason: true },
          },
        },
      },
    },
  } satisfies Prisma.NewsletterCitationFindManyArgs;

  const rows = await deps.newsletterCitation.findMany(findManyArgs);

  type CitationRow = Prisma.NewsletterCitationGetPayload<typeof findManyArgs>;

  const mapped = (rows as CitationRow[]).map((row) => {
    const { dataSource } = row;
    const tickerSection = dataSource.tickerSections[0];
    const collectionSource = classifyCollectionSource(
      dataSource.searchQueryId !== null,
    );
    const classifiedSectionKey = tickerSection?.section ?? null;
    const sectionMismatch =
      classifiedSectionKey !== null && classifiedSectionKey !== row.sectionKey;

    return {
      id: dataSource.id,
      title: dataSource.title,
      url: dataSource.url,
      publishedSectionKey: row.sectionKey,
      publishedSection: sectionLabel(row.sectionKey),
      sectionScore: tickerSection?.sectionScore ?? null,
      sectionReason: tickerSection?.sectionReason ?? "",
      collectionSource,
      queryText:
        dataSource.searchQuery?.text ??
        (collectionSource === "page-collection" ? CURATED_SOURCE_LABEL : ""),
      queryLinkTickerId: collectionSource === "data-collection" ? tickerId : "",
      classifiedSection: sectionMismatch
        ? sectionLabel(classifiedSectionKey)
        : "",
      sectionMismatch,
    } satisfies CitedArticlePayload;
  });

  mapped.sort((left, right) => {
    const orderDelta =
      sectionOrder(left.publishedSectionKey) -
      sectionOrder(right.publishedSectionKey);
    if (orderDelta !== 0) return orderDelta;
    const leftScore = left.sectionScore ?? -1;
    const rightScore = right.sectionScore ?? -1;
    if (rightScore !== leftScore) return rightScore - leftScore;
    return left.title.localeCompare(right.title);
  });

  return mapped;
};
