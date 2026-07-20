import type {
  NewsletterArticle,
  NewsletterDocument,
  NewsletterSection,
} from "@workspace/email-templates/newsletter-document";
import { NEWSLETTER_SECTION_KEYS } from "@workspace/email-templates/newsletter-document";

import type { NewsletterDraft } from "./newsletter-draft-schema.js";

/** Minimal source row used to resolve `articleIndex` into a URL and byline. */
export type NewsletterSourceRow = {
  url: string;
  title?: string | null;
  author?: string | null;
  source?: string | null;
};

/** Counts of articles dropped while resolving, for diagnostics. */
export type ResolveNewsletterDraftReport = {
  articlesDroppedUnresolvedIndex: number;
  sectionsDroppedEmpty: number;
};

export type ResolveNewsletterDraftResult = {
  document: NewsletterDocument;
  report: ResolveNewsletterDraftReport;
};

const trimmedOrUndefined = (value?: string | null): string | undefined => {
  const trimmed = value?.trim() ?? "";

  return trimmed.length > 0 ? trimmed : undefined;
};

/**
 * Attaches grounded URLs and bylines to a model draft, producing a stored document.
 *
 * An article whose `articleIndex` does not resolve to a source row is dropped rather
 * than emitted without a URL, because `url` is required on a stored article. A section
 * left with no articles is dropped in turn. Sections are emitted in canonical order,
 * so the model cannot reorder the newsletter.
 *
 * @param draft - Validated model output.
 * @param sources - Source rows in prompt order; `articleIndex` is 1-based into this list.
 * @returns The stored document and a report of what was dropped.
 */
export const resolveNewsletterDraft = (
  draft: NewsletterDraft,
  sources: readonly NewsletterSourceRow[],
): ResolveNewsletterDraftResult => {
  let articlesDroppedUnresolvedIndex = 0;
  let sectionsDroppedEmpty = 0;

  const byKey = new Map<string, NewsletterArticle[]>();

  for (const section of draft.sections) {
    const resolved: NewsletterArticle[] = [];
    for (const article of section.articles) {
      const row = sources[article.articleIndex - 1];
      const url = trimmedOrUndefined(row?.url);
      if (url === undefined) {
        articlesDroppedUnresolvedIndex += 1;
        continue;
      }
      const author = trimmedOrUndefined(row?.author);
      const source = trimmedOrUndefined(row?.source);
      resolved.push({
        title: article.title,
        url,
        points: article.points,
        ...(author !== undefined ? { author } : {}),
        ...(source !== undefined ? { source } : {}),
      });
    }
    if (resolved.length === 0) {
      sectionsDroppedEmpty += 1;
      continue;
    }
    byKey.set(section.key, [...(byKey.get(section.key) ?? []), ...resolved]);
  }

  const sections: NewsletterSection[] = NEWSLETTER_SECTION_KEYS.flatMap(
    (key) => {
      const articles = byKey.get(key);

      return articles === undefined || articles.length === 0
        ? []
        : [{ key, articles }];
    },
  );

  return {
    document: { version: 1, sections },
    report: { articlesDroppedUnresolvedIndex, sectionsDroppedEmpty },
  };
};
