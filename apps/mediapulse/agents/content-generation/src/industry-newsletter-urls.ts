import type { IndustryNewsletterStructure } from "./industry-newsletter-schema.js";

/** Minimal source row used to resolve `articleIndex` into an HTTPS URL. */
export type IndustryNewsletterSourceRow = {
  url: string;
};

/** Bullet with an optional grounded article URL. */
export type IndustryBulletResolved = {
  title?: string;
  text: string;
  url?: string;
};

/** Quick hit with a grounded article URL when the index resolves. */
export type IndustryQuickHitResolved = {
  title?: string;
  text: string;
  url?: string;
};

export type IndustryDisruptorsOrTechResolved =
  | {
      format: "prose";
      displayHeading: string;
      prose: string;
    }
  | {
      format: "bullets";
      displayHeading: string;
      bullets: IndustryBulletResolved[];
    };

/**
 * Industry briefing ready for wire formatting (all URLs from config, not the LLM).
 *
 * `subject` is required. `industryPulse` is optional — it is omitted when the prune
 * pass removes the lead for lacking a resolvable citation. All five body sections are
 * optional: absence is represented by the field being `undefined`, never by an empty
 * bullets/items array. A zero-row section is a contradiction the serializer refuses to emit.
 * See `formatIndustryNewsletterWire` for the wire contract.
 */
export type IndustryNewsletterResolved = {
  subject: string;
  industryPulse?: { displayHeading: string; prose: string; url?: string };
  competitiveLandscape?: {
    displayHeading: string;
    bullets: IndustryBulletResolved[];
  };
  dealsAndMovements?: {
    displayHeading: string;
    bullets: IndustryBulletResolved[];
  };
  regulatoryPolicyWatch?: {
    displayHeading: string;
    bullets: IndustryBulletResolved[];
  };
  disruptorsOrTech?: IndustryDisruptorsOrTechResolved;
  quickHits?: {
    displayHeading: string;
    items: IndustryQuickHitResolved[];
  };
};

/**
 * Resolves a 1-based article index against the ordered source list.
 *
 * @param index - 1-based article index from the LLM, when defined.
 * @param sources - Articles in prompt order (`Article 1` … `Article N`).
 * @returns Trimmed URL when the index is in range and non-empty; otherwise `undefined`.
 */
export const resolveArticleUrlForIndustryNewsletter = (
  index: number | undefined,
  sources: ReadonlyArray<IndustryNewsletterSourceRow>,
): string | undefined => {
  if (index === undefined) return undefined;
  const row = sources[index - 1];
  const url = row?.url?.trim() ?? "";
  return url.length > 0 ? url : undefined;
};

/**
 * Attaches `url` fields from Hermes-selected sources using each `articleIndex`.
 *
 * @param briefing - Validated LLM object (no URLs from the model).
 * @param sources - Same ordered slice passed into the prompt (`Article 1` first).
 * @returns A copy safe to pass into the wire serializer.
 */
export const attachIndustryNewsletterSourceUrls = (
  briefing: IndustryNewsletterStructure,
  sources: ReadonlyArray<IndustryNewsletterSourceRow>,
): IndustryNewsletterResolved => {
  const mapBullet = (b: {
    title: string;
    text: string;
    articleIndex?: number;
  }): IndustryBulletResolved => ({
    title: b.title,
    text: b.text,
    url: resolveArticleUrlForIndustryNewsletter(b.articleIndex, sources),
  });

  const mapHit = (h: {
    title: string;
    text: string;
    articleIndex: number;
  }): IndustryQuickHitResolved => ({
    title: h.title,
    text: h.text,
    url: resolveArticleUrlForIndustryNewsletter(h.articleIndex, sources),
  });

  const disruptors: IndustryDisruptorsOrTechResolved =
    briefing.disruptorsOrTech.format === "prose"
      ? {
          format: "prose",
          displayHeading: briefing.disruptorsOrTech.displayHeading,
          prose: briefing.disruptorsOrTech.prose,
        }
      : {
          format: "bullets",
          displayHeading: briefing.disruptorsOrTech.displayHeading,
          bullets: briefing.disruptorsOrTech.bullets.map(mapBullet),
        };

  const leadUrl = resolveArticleUrlForIndustryNewsletter(
    briefing.industryPulse.articleIndex,
    sources,
  );

  return {
    subject: briefing.subject,
    industryPulse: {
      displayHeading: briefing.industryPulse.displayHeading,
      prose: briefing.industryPulse.prose,
      ...(leadUrl !== undefined ? { url: leadUrl } : {}),
    },
    competitiveLandscape: {
      displayHeading: briefing.competitiveLandscape.displayHeading,
      bullets: briefing.competitiveLandscape.bullets.map(mapBullet),
    },
    dealsAndMovements: {
      displayHeading: briefing.dealsAndMovements.displayHeading,
      bullets: briefing.dealsAndMovements.bullets.map(mapBullet),
    },
    regulatoryPolicyWatch: {
      displayHeading: briefing.regulatoryPolicyWatch.displayHeading,
      bullets: briefing.regulatoryPolicyWatch.bullets.map(mapBullet),
    },
    disruptorsOrTech: disruptors,
    quickHits: {
      displayHeading: briefing.quickHits.displayHeading,
      items: briefing.quickHits.items.map(mapHit),
    },
  };
};
