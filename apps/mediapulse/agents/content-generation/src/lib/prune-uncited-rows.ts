import type {
  NewsletterArticle,
  NewsletterDocument,
  NewsletterSection,
  NewsletterSectionKey,
} from "@workspace/email-templates/newsletter-document";
import { NEWSLETTER_SECTION_KEYS } from "@workspace/email-templates/newsletter-document";

import {
  buildWordShingles,
  shingleJaccardSimilarity,
} from "./citation-grounding.js";
import { tokenize } from "./phrase-link-injector.js";

/** Why a row was removed by the prune pass. */
export type PrunedRowReason = "uncited" | "duplicate_article";

/** Per-section outcome for a single prune pass. */
export type PruneReport = {
  sectionKey: string;
  removedBullets: number;
  removedForDuplicate: number;
  sectionRemoved: boolean;
};

/** Rolled-up counters for the run-details surface. */
export type PruneSummary = {
  sectionsRemoved: number;
  bulletsRemovedUncited: number;
  bulletsRemovedDuplicate: number;
  bulletsRemovedDuplicateTitle: number;
  sectionsKept: number;
};

export type PruneSectionKey = NewsletterSectionKey;

export type PruneOptions = {
  /** Which sections to apply pruning to. Defaults to all canonical sections. */
  sections?: ReadonlyArray<PruneSectionKey>;
  /** When true, two articles citing the same URL in the same scope are deduped. */
  dedupeArticlesWithinSection?: boolean;
  /**
   * Controls whether dedup tracks seen URLs per-section ('section') or across
   * the entire newsletter ('newsletter'). Defaults to 'section'.
   */
  dedupeScope?: "section" | "newsletter";
  /**
   * When true, drops articles whose normalized title duplicates an earlier article's title
   * across the entire newsletter. Defaults to true.
   */
  dedupeTitlesWithinNewsletter?: boolean;
};

export type PruneNewsletterResult = {
  document: NewsletterDocument;
  reports: PruneReport[];
  summary: PruneSummary;
};

const ALL_SECTIONS: ReadonlyArray<PruneSectionKey> = NEWSLETTER_SECTION_KEYS;

/** An article is cited iff `resolveNewsletterDraft` attached a non-empty grounded URL. */
const isRowCited = (article: NewsletterArticle): boolean =>
  article.url.trim().length > 0;

/** Normalizes a title for uniqueness comparison: lowercase, collapse whitespace, strip trailing punctuation. */
const normalizeTitle = (title: string): string =>
  title
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.,;!?]+$/, "")
    .trim();

function pruneRows(
  articles: ReadonlyArray<NewsletterArticle>,
  seenUrls: Set<string>,
  dedupeEnabled: boolean,
): {
  kept: NewsletterArticle[];
  removedUncited: number;
  removedDuplicate: number;
} {
  let removedUncited = 0;
  let removedDuplicate = 0;
  const kept: NewsletterArticle[] = [];

  for (const article of articles) {
    if (!isRowCited(article)) {
      removedUncited++;
      continue;
    }
    if (dedupeEnabled) {
      if (seenUrls.has(article.url)) {
        removedDuplicate++;
        continue;
      }
      seenUrls.add(article.url);
    }
    kept.push(article);
  }

  return { kept, removedUncited, removedDuplicate };
}

/**
 * Removes uncited and duplicate-article rows from a newsletter document.
 *
 * A section that drops to zero cited articles is removed from the document.
 *
 * @param document - Stored document produced by `resolveNewsletterDraft`.
 * @param opts - Which sections to prune and dedup settings.
 * @returns Pruned document, per-section reports, and rolled-up summary.
 */
export function pruneNewsletterToCitedRows(
  document: NewsletterDocument,
  opts: PruneOptions = {},
): PruneNewsletterResult {
  const configuredSections = opts.sections ?? ALL_SECTIONS;
  const dedupeEnabled = opts.dedupeArticlesWithinSection ?? true;
  const dedupeScope = opts.dedupeScope ?? "section";
  const dedupeTitles = opts.dedupeTitlesWithinNewsletter ?? true;

  const reports: PruneReport[] = [];
  let sectionsRemoved = 0;
  let bulletsRemovedUncited = 0;
  let bulletsRemovedDuplicate = 0;
  let bulletsRemovedDuplicateTitle = 0;
  let sectionsKept = 0;

  const seenTitles = new Set<string>();

  const filterByTitle = (
    articles: NewsletterArticle[],
  ): NewsletterArticle[] => {
    if (!dedupeTitles) {
      return articles;
    }
    const kept: NewsletterArticle[] = [];
    for (const article of articles) {
      const normalized = normalizeTitle(article.title);
      if (seenTitles.has(normalized)) {
        bulletsRemovedDuplicateTitle++;
        continue;
      }
      seenTitles.add(normalized);
      kept.push(article);
    }

    return kept;
  };

  // Shared URL set used when dedupeScope === 'newsletter'.
  const newsletterSeenUrls = new Set<string>();

  const getSeenUrls = (): Set<string> =>
    dedupeScope === "newsletter" ? newsletterSeenUrls : new Set<string>();

  const shouldPrune = (key: NewsletterSectionKey): boolean =>
    (configuredSections as ReadonlyArray<string>).includes(key);

  const sections: NewsletterSection[] = [];

  for (const section of document.sections) {
    if (!shouldPrune(section.key)) {
      sections.push(section);
      continue;
    }

    const {
      kept: citedKept,
      removedUncited,
      removedDuplicate,
    } = pruneRows(section.articles, getSeenUrls(), dedupeEnabled);
    bulletsRemovedUncited += removedUncited;
    bulletsRemovedDuplicate += removedDuplicate;
    const kept = filterByTitle(citedKept);
    const sectionRemoved = kept.length === 0;
    reports.push({
      sectionKey: section.key,
      removedBullets: removedUncited,
      removedForDuplicate: removedDuplicate,
      sectionRemoved,
    });

    if (sectionRemoved) {
      sectionsRemoved++;
      continue;
    }
    sectionsKept++;
    sections.push({ key: section.key, articles: kept });
  }

  return {
    document: { version: 1, sections },
    reports,
    summary: {
      sectionsRemoved,
      bulletsRemovedUncited,
      bulletsRemovedDuplicate,
      bulletsRemovedDuplicateTitle,
      sectionsKept,
    },
  };
}

/** Outcome of the within-run semantic dedup pass. */
export type WithinRunDedupResult = {
  document: NewsletterDocument;
  removedCount: number;
};

const DEFAULT_TITLE_DEDUP_SIMILARITY = 0.5;

const articleComparisonText = (article: NewsletterArticle): string =>
  `${article.title} ${article.points.join(" ")}`;

const scoreItemSimilarity = (
  left: NewsletterArticle,
  right: NewsletterArticle,
): number => {
  const leftShingles = buildWordShingles(tokenize(articleComparisonText(left)));
  const rightShingles = buildWordShingles(
    tokenize(articleComparisonText(right)),
  );

  return shingleJaccardSimilarity(leftShingles, rightShingles);
};

// Bag-of-words over titles, not 3-grams: reworded headlines of one event keep the same token set
// but few shared 3-grams, so text similarity misses them.
const scoreTitleSimilarity = (
  left: NewsletterArticle,
  right: NewsletterArticle,
): number => {
  const leftTokens = new Set(tokenize(left.title));
  const rightTokens = new Set(tokenize(right.title));

  return shingleJaccardSimilarity(leftTokens, rightTokens);
};

const dedupeItems = (
  articles: ReadonlyArray<NewsletterArticle>,
  seenTitles: Set<string>,
  corpus: NewsletterArticle[],
  minSimilarity: number,
  titleMinSimilarity: number,
): { kept: NewsletterArticle[]; removedCount: number } => {
  const kept: NewsletterArticle[] = [];
  let removedCount = 0;

  for (const article of articles) {
    const normalizedTitle = normalizeTitle(article.title);
    if (seenTitles.has(normalizedTitle)) {
      removedCount++;
      continue;
    }

    let isDuplicate = false;
    for (const seenArticle of corpus) {
      if (
        scoreItemSimilarity(article, seenArticle) >= minSimilarity ||
        scoreTitleSimilarity(article, seenArticle) >= titleMinSimilarity
      ) {
        isDuplicate = true;
        break;
      }
    }

    if (isDuplicate) {
      removedCount++;
      continue;
    }

    seenTitles.add(normalizedTitle);
    corpus.push(article);
    kept.push(article);
  }

  return { kept, removedCount };
};

/**
 * Removes semantically near-duplicate articles from a newsletter document using
 * n-gram Jaccard similarity over article text and normalized title matching.
 *
 * Operates newsletter-wide: an article kept in an earlier section can suppress a
 * duplicate in a later section.
 *
 * @param document - Document after citation pruning.
 * @param minSimilarity - Jaccard threshold above which two articles are considered
 *   the same story (default 0.55).
 * @param titleMinSimilarity - Token-overlap threshold for titles.
 */
export const dedupeWithinRun = (
  document: NewsletterDocument,
  minSimilarity: number = 0.55,
  titleMinSimilarity: number = DEFAULT_TITLE_DEDUP_SIMILARITY,
): WithinRunDedupResult => {
  const seenTitles = new Set<string>();
  const corpus: NewsletterArticle[] = [];
  const sections: NewsletterSection[] = [];
  let totalRemoved = 0;

  for (const section of document.sections) {
    const { kept, removedCount } = dedupeItems(
      section.articles,
      seenTitles,
      corpus,
      minSimilarity,
      titleMinSimilarity,
    );
    totalRemoved += removedCount;
    if (kept.length > 0) {
      sections.push({ key: section.key, articles: kept });
    }
  }

  return {
    document: { version: 1, sections },
    removedCount: totalRemoved,
  };
};
