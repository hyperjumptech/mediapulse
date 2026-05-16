import { z } from "zod";

/** 1-based index into the numbered `Article N:` list in the user prompt. */
const articleIndexSchema = z.number().int().positive();

/** A bullet that may optionally cite a source article by index. */
export const industryBriefBulletSchema = z.object({
  text: z.string().min(1),
  articleIndex: articleIndexSchema.optional(),
});

/** Quick hit line; every hit must cite an article for grounded links. */
export const industryQuickHitSchema = z.object({
  text: z.string().min(1),
  articleIndex: articleIndexSchema,
});

export const disruptorsOrTechProseSchema = z.object({
  format: z.literal("prose"),
  displayHeading: z.string().min(1),
  prose: z.string().min(1),
});

export const disruptorsOrTechBulletsSchema = z.object({
  format: z.literal("bullets"),
  displayHeading: z.string().min(1),
  bullets: z.array(industryBriefBulletSchema).min(1).max(3),
});

export const disruptorsOrTechSchema = z.discriminatedUnion("format", [
  disruptorsOrTechProseSchema,
  disruptorsOrTechBulletsSchema,
]);

export const readWatchListenSchema = z.object({
  displayHeading: z.string().min(1),
  summary: z.string().min(1),
  articleIndex: articleIndexSchema,
});

export const quoteOfTheWeekSchema = z.object({
  displayHeading: z.string().min(1),
  quote: z.string().min(1),
  attribution: z.string().min(1),
  articleIndex: articleIndexSchema.optional(),
});

/**
 * Zod schema for the industry-intelligence newsletter JSON returned by the LLM.
 *
 * URLs are never read from the model; callers attach them from `articleIndex`
 * after validation using {@link attachIndustryNewsletterSourceUrls}.
 */
export const industryNewsletterStructureSchema = z.object({
  subject: z.string().min(1),
  industryPulse: z.object({
    displayHeading: z.string().min(1),
    prose: z.string().min(1),
  }),
  competitiveLandscape: z.object({
    displayHeading: z.string().min(1),
    bullets: z.array(industryBriefBulletSchema).min(2).max(3),
  }),
  dealsAndMovements: z.object({
    displayHeading: z.string().min(1),
    bullets: z.array(industryBriefBulletSchema).min(1).max(3),
  }),
  regulatoryPolicyWatch: z.object({
    displayHeading: z.string().min(1),
    bullets: z.array(industryBriefBulletSchema).min(1).max(3),
  }),
  disruptorsOrTech: disruptorsOrTechSchema,
  quickHits: z.object({
    displayHeading: z.string().min(1),
    items: z.array(industryQuickHitSchema).min(5).max(7),
  }),
  readWatchListen: readWatchListenSchema.optional(),
  quoteOfTheWeek: quoteOfTheWeekSchema.optional(),
});

export type IndustryNewsletterStructure = z.infer<
  typeof industryNewsletterStructureSchema
>;
