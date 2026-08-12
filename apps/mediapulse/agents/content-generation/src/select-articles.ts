import {
  MAX_ARTICLES_PER_SECTION,
  NEWSLETTER_SECTION_KEYS,
  type NewsletterSectionKey,
} from "@workspace/email-templates/newsletter-document";
import {
  classifyNoisyUrl,
  isUnresolvableAggregatorUrl,
  isUserGeneratedHost,
} from "@workspace/utils";

import { compareSourcesForRanking } from "./lib/rank-sources.js";
import type { SourceForGeneration } from "./types.js";

/** Maps the camelCase section ids used upstream to the document's kebab-case keys. */
const SECTION_KEY_BY_ID: Record<string, NewsletterSectionKey> = {
  industryPulse: "industry-pulse",
  issuerPerformance: "issuer-performance",
  competitiveLandscape: "competitive-landscape",
  dealsAndMovements: "deals-and-movements",
  regulatoryPolicyWatch: "regulatory-policy-watch",
  disruptorsOrTech: "disruptors-or-tech",
  quickHits: "quick-hits",
};

/** A source chosen for the newsletter, paired with the section it will appear in. */
export type SelectedArticle = {
  sectionKey: NewsletterSectionKey;
  source: SourceForGeneration;
};

export type SelectArticlesReport = {
  /** Sources whose upstream section was missing or unrecognized. */
  droppedUnassigned: number;
  /** Sources beyond the per-section cap. */
  droppedOverCap: number;
  /** Sources on a host blocked repo-wide, classified before the host was listed. */
  droppedBlockedHost: number;
  /** Reader-contributed sources that had been placed in Issuer Performance. */
  droppedUserGenerated: number;
};

export type SelectArticlesResult = {
  selected: SelectedArticle[];
  report: SelectArticlesReport;
};

/**
 * Resolves the upstream section id to a document section key.
 *
 * @param section - Section id assigned by article-analysis.
 * @returns The document key, or `undefined` when unassigned or unrecognized.
 */
const toSectionKey = (
  section?: string | null,
): NewsletterSectionKey | undefined => {
  if (section === undefined || section === null) {
    return undefined;
  }

  return SECTION_KEY_BY_ID[section];
};

/**
 * Chooses which articles appear in the newsletter and where.
 *
 * Section placement comes from article-analysis and is never revisited here. Within a
 * section, sources are ranked by {@link compareSourcesForRanking}, which orders on
 * `sectionScore` and breaks equal fit on `publisherAuthority`, and the top
 * {@link MAX_ARTICLES_PER_SECTION} are kept. Only when both are equal does the caller's
 * ordering decide, so the result is stable. Sections are emitted in canonical order, so the
 * newsletter's shape does not depend on input order.
 *
 * @param sources - Candidate sources, already deduplicated.
 * @returns Selected articles in render order, plus a report of what was dropped.
 */
export const selectArticles = (
  sources: readonly SourceForGeneration[],
): SelectArticlesResult => {
  let droppedUnassigned = 0;
  let droppedBlockedHost = 0;
  let droppedUserGenerated = 0;
  const bySection = new Map<
    NewsletterSectionKey,
    Array<{ source: SourceForGeneration; order: number }>
  >();

  sources.forEach((source, order) => {
    const sectionKey = toSectionKey(source.section);
    if (sectionKey === undefined) {
      droppedUnassigned += 1;
      return;
    }
    if (
      classifyNoisyUrl(source.url).blocked ||
      isUnresolvableAggregatorUrl(source.url)
    ) {
      droppedBlockedHost += 1;
      return;
    }
    if (
      sectionKey === "issuer-performance" &&
      isUserGeneratedHost(source.url)
    ) {
      droppedUserGenerated += 1;
      return;
    }
    const bucket = bySection.get(sectionKey) ?? [];
    bucket.push({ source, order });
    bySection.set(sectionKey, bucket);
  });

  let droppedOverCap = 0;
  const selected: SelectedArticle[] = [];

  for (const sectionKey of NEWSLETTER_SECTION_KEYS) {
    const bucket = bySection.get(sectionKey);
    if (bucket === undefined) {
      continue;
    }
    const ranked = [...bucket].sort((first, second) => {
      const rankDiff = compareSourcesForRanking(first.source, second.source);

      return rankDiff !== 0 ? rankDiff : first.order - second.order;
    });
    droppedOverCap += Math.max(0, ranked.length - MAX_ARTICLES_PER_SECTION);
    for (const entry of ranked.slice(0, MAX_ARTICLES_PER_SECTION)) {
      selected.push({ sectionKey, source: entry.source });
    }
  }

  return {
    selected,
    report: {
      droppedUnassigned,
      droppedOverCap,
      droppedBlockedHost,
      droppedUserGenerated,
    },
  };
};
