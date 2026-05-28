import { parseIndustryNewsletterWire } from "@workspace/email-templates/parse-industry-newsletter-wire";

/** Maps wire machine keys to structured JSON `sectionKey` names. */
const MACHINE_KEY_TO_SECTION_KEY: Record<string, string> = {
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
 * Flattens a persisted newsletter wire body into comparable bullet rows.
 *
 * @param newsletterId - Persisted newsletter id.
 * @param content - Wire body text (`MP_NEWSLETTER`).
 * @param createdAt - ISO timestamp for the newsletter row.
 */
export const flattenBulletsFromNewsletterWire = (
  newsletterId: string,
  content: string,
  createdAt: string,
): FlattenedNewsletterBullet[] => {
  const parsed = parseIndustryNewsletterWire(content);
  if (parsed === undefined) {
    return [];
  }

  const bullets: FlattenedNewsletterBullet[] = [];

  for (const section of parsed.sections) {
    const sectionKey = MACHINE_KEY_TO_SECTION_KEY[section.machineKey];
    if (sectionKey === undefined) {
      continue;
    }

    if (
      section.machineKey === "competitive-landscape" ||
      section.machineKey === "deals-and-movements" ||
      section.machineKey === "regulatory-policy-watch"
    ) {
      for (const bullet of section.bullets) {
        if (bullet.text.trim().length === 0) {
          continue;
        }
        bullets.push({
          newsletterId,
          sectionKey,
          bulletText: bullet.text.trim(),
          createdAt,
        });
      }
      continue;
    }

    if (section.machineKey === "disruptors-or-tech" && "bullets" in section) {
      for (const bullet of section.bullets) {
        if (bullet.text.trim().length === 0) {
          continue;
        }
        bullets.push({
          newsletterId,
          sectionKey,
          bulletText: bullet.text.trim(),
          createdAt,
        });
      }
      continue;
    }

    if (section.machineKey === "quick-hits") {
      for (const item of section.items) {
        if (item.text.trim().length === 0) {
          continue;
        }
        bullets.push({
          newsletterId,
          sectionKey,
          bulletText: item.text.trim(),
          createdAt,
        });
      }
    }
  }

  return bullets;
};
