import type { NewsletterSectionKey } from "@workspace/email-templates/newsletter-document";
import { readNewsletterDocument } from "@workspace/email-templates/newsletter-document";

/** Maps document section keys to the camelCase `sectionKey` names the API surfaces. */
const DOCUMENT_KEY_TO_SECTION_KEY: Record<NewsletterSectionKey, string> = {
  "industry-pulse": "industryPulse",
  "competitive-landscape": "competitiveLandscape",
  "deals-and-movements": "dealsAndMovements",
  "regulatory-policy-watch": "regulatoryPolicyWatch",
  "disruptors-or-tech": "disruptorsOrTech",
  "quick-hits": "quickHits",
};

export type FlattenedNewsletterBullet = {
  newsletterId: string;
  sectionKey: string;
  bulletText: string;
  createdAt: string;
};

/**
 * Flattens a persisted newsletter document into comparable bullet rows.
 *
 * One row per article, its summary points joined, which is the same text the
 * content-generation agent compares against for cross-day dedup.
 *
 * @param newsletterId - Persisted newsletter id.
 * @param content - Stored `Newsletter.content` JSON document.
 * @param createdAt - ISO timestamp for the newsletter row.
 */
export const flattenBulletsFromNewsletterDocument = (
  newsletterId: string,
  content: string,
  createdAt: string,
): FlattenedNewsletterBullet[] => {
  const document = readNewsletterDocument(content);
  if (document === undefined) {
    return [];
  }

  const bullets: FlattenedNewsletterBullet[] = [];

  for (const section of document.sections) {
    const sectionKey = DOCUMENT_KEY_TO_SECTION_KEY[section.key];
    for (const article of section.articles) {
      const bulletText = article.points.join(" ").trim();
      if (bulletText.length === 0) {
        continue;
      }
      bullets.push({ newsletterId, sectionKey, bulletText, createdAt });
    }
  }

  return bullets;
};
