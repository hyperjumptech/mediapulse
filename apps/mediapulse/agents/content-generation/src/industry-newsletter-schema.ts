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
    articleIndex: articleIndexSchema.optional(),
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
});

export type IndustryNewsletterStructure = z.infer<
  typeof industryNewsletterStructureSchema
>;

/** Maps a nullable LLM article index to the optional parsed shape. */
const normalizeOptionalArticleIndex = (
  articleIndex: number | null,
): number | undefined => (articleIndex === null ? undefined : articleIndex);

/** OpenAI strict JSON schema requires every property key in `required`; bullets use null when uncited. */
const industryBriefBulletLlmSchema = z
  .object({
    text: z.string().min(1),
    articleIndex: z.union([articleIndexSchema, z.null()]),
  })
  .transform(
    ({ text, articleIndex }): z.infer<typeof industryBriefBulletSchema> => {
      const normalizedIndex = normalizeOptionalArticleIndex(articleIndex);
      return normalizedIndex === undefined
        ? { text }
        : { text, articleIndex: normalizedIndex };
    },
  );

const industryPulseLlmSchema = z
  .object({
    displayHeading: z.string().min(1),
    prose: z.string().min(1),
    articleIndex: z.union([articleIndexSchema, z.null()]),
  })
  .transform(
    ({
      displayHeading,
      prose,
      articleIndex,
    }): z.infer<typeof industryNewsletterStructureSchema>["industryPulse"] => {
      const normalizedIndex = normalizeOptionalArticleIndex(articleIndex);
      return normalizedIndex === undefined
        ? { displayHeading, prose }
        : { displayHeading, prose, articleIndex: normalizedIndex };
    },
  );

const disruptorsOrTechBulletsLlmSchema = z.object({
  format: z.literal("bullets"),
  displayHeading: z.string().min(1),
  bullets: z.array(industryBriefBulletLlmSchema).min(1).max(3),
});

const disruptorsOrTechLlmSchema = z.discriminatedUnion("format", [
  disruptorsOrTechProseSchema,
  disruptorsOrTechBulletsLlmSchema,
]);

/**
 * OpenAI-compatible schema for structured newsletter generation.
 *
 * Nullable fields satisfy strict JSON-schema `required` rules; transforms
 * normalize output to {@link industryNewsletterStructureSchema}.
 */
export const industryNewsletterStructureLlmSchema = z
  .object({
    subject: z.string().min(1),
    industryPulse: industryPulseLlmSchema,
    competitiveLandscape: z.object({
      displayHeading: z.string().min(1),
      bullets: z.array(industryBriefBulletLlmSchema).min(2).max(3),
    }),
    dealsAndMovements: z.object({
      displayHeading: z.string().min(1),
      bullets: z.array(industryBriefBulletLlmSchema).min(1).max(3),
    }),
    regulatoryPolicyWatch: z.object({
      displayHeading: z.string().min(1),
      bullets: z.array(industryBriefBulletLlmSchema).min(1).max(3),
    }),
    disruptorsOrTech: disruptorsOrTechLlmSchema,
    quickHits: z.object({
      displayHeading: z.string().min(1),
      items: z.array(industryQuickHitSchema).min(5).max(7),
    }),
  })
  .transform((value): IndustryNewsletterStructure => value);
