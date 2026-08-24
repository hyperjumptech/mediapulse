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
  /** Reader-contributed sources, dropped from every section. */
  droppedUserGenerated: number;
};

export type SelectArticlesResult = {
  selected: SelectedArticle[];
  /**
   * Candidates ranked past the per-section cap, kept in rank order.
   *
   * - Important: a selected article that fails to summarize leaves its section short, and an
   *   emptied section is dropped from the newsletter. The reserve lets the caller promote the
   *   next-ranked candidate instead of shipping without the section.
   */
  reserve: SelectedArticle[];
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
 * Whether a source carries article text rather than only its collection-time description.
 *
 * Among candidates of equal fit this decides which ships. A description-only source has every
 * figure stripped at grounding, because a description has carried a figure its article
 * contradicted before, so a bodiless article reports the story without its numbers. On 2026-08-21
 * BBCA's issuerPerformance held seventeen candidates tied at 0.75, nearly all the same interim
 * dividend, three of them with bodies. A bodiless one shipped, and the newsletter announced a
 * dividend without its amount, its per-share value, or its payment date.
 */
const hasBody = (source: SourceForGeneration): boolean =>
  typeof source.content === "string" && source.content.trim() !== "";

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
 * @returns Selected articles in render order, the ranked reserve past the cap, and a report of
 *   what was dropped.
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
    if (isUserGeneratedHost(source.url)) {
      droppedUserGenerated += 1;
      return;
    }
    const bucket = bySection.get(sectionKey) ?? [];
    bucket.push({ source, order });
    bySection.set(sectionKey, bucket);
  });

  let droppedOverCap = 0;
  const selected: SelectedArticle[] = [];
  const reserve: SelectedArticle[] = [];

  for (const sectionKey of NEWSLETTER_SECTION_KEYS) {
    const bucket = bySection.get(sectionKey);
    if (bucket === undefined) {
      continue;
    }
    const ranked = [...bucket].sort((first, second) => {
      const rankDiff = compareSourcesForRanking(first.source, second.source);
      if (rankDiff !== 0) {
        return rankDiff;
      }
      const bodyDiff =
        Number(hasBody(second.source)) - Number(hasBody(first.source));
      if (bodyDiff !== 0) {
        return bodyDiff;
      }

      return first.order - second.order;
    });
    droppedOverCap += Math.max(0, ranked.length - MAX_ARTICLES_PER_SECTION);
    for (const entry of ranked.slice(0, MAX_ARTICLES_PER_SECTION)) {
      selected.push({ sectionKey, source: entry.source });
    }
    for (const entry of ranked.slice(MAX_ARTICLES_PER_SECTION)) {
      reserve.push({ sectionKey, source: entry.source });
    }
  }

  return {
    selected,
    reserve,
    report: {
      droppedUnassigned,
      droppedOverCap,
      droppedBlockedHost,
      droppedUserGenerated,
    },
  };
};
