import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import type { OpenAiReasoningProviderOptions } from "@workspace/agent-runtime";
import { z } from "zod";

import type { IndustryNewsletterStructure } from "../industry-newsletter-schema.js";
import { industryNewsletterStructureSchema } from "../industry-newsletter-schema.js";
import type { SourceForGeneration } from "../types.js";
import { percentile } from "./citation-grounding.js";

const formatArticleSummariesForCritique = (
  sources: readonly SourceForGeneration[],
): string =>
  sources
    .map(
      (source, index) =>
        `Article ${String(index + 1)}: ${source.title}\n${source.content}`,
    )
    .join("\n\n---\n\n");

/** One critique rating row returned by the self-critique LLM pass. */
export const newsletterCritiqueRatingSchema = z.object({
  sectionKey: z.string(),
  bulletIndex: z.number().int().nonnegative(),
  specificity: z.number().min(1).max(5),
  citationStrength: z.number().min(1).max(5),
  redundancy: z.number().min(1).max(5),
  readerValue: z.number().min(1).max(5),
  drop: z.boolean(),
  suggestedRewrite: z.string().max(400).optional(),
  rationale: z.string().max(200),
});

const newsletterCritiqueRatingLlmSchema = z
  .object({
    sectionKey: z.string(),
    bulletIndex: z.number().int().nonnegative(),
    specificity: z.number().min(1).max(5),
    citationStrength: z.number().min(1).max(5),
    redundancy: z.number().min(1).max(5),
    readerValue: z.number().min(1).max(5),
    drop: z.boolean(),
    suggestedRewrite: z.union([z.string().max(400), z.null()]),
    rationale: z.string().max(200),
  })
  .transform(
    ({
      suggestedRewrite,
      ...rest
    }): z.infer<typeof newsletterCritiqueRatingSchema> => ({
      ...rest,
      ...(suggestedRewrite === null ? {} : { suggestedRewrite }),
    }),
  );

/** Self-critique JSON shape from the critic model. */
export const newsletterCritiqueSchema = z.object({
  ratings: z.array(newsletterCritiqueRatingSchema),
});

/** OpenAI strict JSON schema for the self-critique `generateObject` pass. */
export const newsletterCritiqueLlmSchema = z.object({
  ratings: z.array(newsletterCritiqueRatingLlmSchema),
});

export type NewsletterCritiqueRating = z.infer<
  typeof newsletterCritiqueRatingSchema
>;
export type NewsletterCritiqueResult = z.infer<typeof newsletterCritiqueSchema>;

/** One bullet row sent to the critic model. */
export type NewsletterCritiqueCandidate = {
  sectionKey: string;
  bulletIndex: number;
  text: string;
  articleIndex?: number;
};

/** Rolled-up self-critique counters for logs and run details. */
export type NewsletterCritiqueSummary = {
  bulletsRated: number;
  bulletsRewritten: number;
  bulletsDropped: number;
  floorPreserved: number;
  promptTokens: number | null;
  completionTokens: number | null;
  p50Specificity: number;
  p50ReaderValue: number;
};

export type SelfCritiqueApplyOptions = {
  dropFraction: number;
  preferRewriteOverDrop: boolean;
};

const SECTION_MIN_COUNTS: Partial<Record<string, number>> = {
  competitiveLandscape: 2,
  dealsAndMovements: 1,
  regulatoryPolicyWatch: 1,
  "disruptorsOrTech.bullets": 1,
  quickHits: 5,
};

const CRITIQUE_SYSTEM_PROMPT = [
  "You are an industry briefing editor reviewing candidate bullets before they ship to subscribers.",
  "Score each numbered candidate on four dimensions (1=weak, 5=strong):",
  "specificity — concrete facts vs cargo-cult prose;",
  "citationStrength — is the cited Article N the best source for this claim;",
  "redundancy — overlap with other bullets in this briefing (5=distinct);",
  "readerValue — would an industry operator act on this?",
  "Set drop=true only when the bullet should be removed or rewritten.",
  "When drop=true, provide suggestedRewrite with improved text grounded in the articles (same articleIndex when possible).",
  "Rate ONLY the candidate rows provided — do not invent new bullets.",
].join(" ");

/**
 * Collects critique candidate rows from a validated newsletter structure.
 *
 * @param structure - Post-grounding newsletter JSON.
 */
export const collectNewsletterCritiqueCandidates = (
  structure: IndustryNewsletterStructure,
): NewsletterCritiqueCandidate[] => {
  const candidates: NewsletterCritiqueCandidate[] = [];

  const pushBullets = (
    sectionKey: string,
    bullets: Array<{ text: string; articleIndex?: number }>,
  ) => {
    bullets.forEach((bullet, bulletIndex) => {
      candidates.push({
        sectionKey,
        bulletIndex,
        text: bullet.text,
        ...(bullet.articleIndex !== undefined
          ? { articleIndex: bullet.articleIndex }
          : {}),
      });
    });
  };

  pushBullets("competitiveLandscape", structure.competitiveLandscape.bullets);
  pushBullets("dealsAndMovements", structure.dealsAndMovements.bullets);
  pushBullets("regulatoryPolicyWatch", structure.regulatoryPolicyWatch.bullets);

  if (structure.disruptorsOrTech.format === "bullets") {
    pushBullets("disruptorsOrTech.bullets", structure.disruptorsOrTech.bullets);
  }

  structure.quickHits.items.forEach((item, bulletIndex) => {
    candidates.push({
      sectionKey: "quickHits",
      bulletIndex,
      text: item.text,
      articleIndex: item.articleIndex,
    });
  });

  return candidates;
};

/**
 * Returns the total bullet/quick-hit count across critique-eligible sections.
 *
 * @param structure - Newsletter JSON to count.
 */
export const countNewsletterCritiqueBullets = (
  structure: IndustryNewsletterStructure,
): number => collectNewsletterCritiqueCandidates(structure).length;

/**
 * Serializes critique candidates for the critic user prompt.
 *
 * @param candidates - Bullet rows to rate.
 */
export const formatNewsletterCritiqueCandidatesBlock = (
  candidates: readonly NewsletterCritiqueCandidate[],
): string =>
  candidates
    .map((candidate) => {
      const citation =
        candidate.articleIndex !== undefined
          ? ` articleIndex=${String(candidate.articleIndex)}`
          : "";
      return `${candidate.sectionKey}:${String(candidate.bulletIndex)} | ${candidate.text}${citation}`;
    })
    .join("\n");

/**
 * Builds the self-critique system prompt.
 */
export const buildNewsletterCritiqueSystemPrompt = (): string =>
  CRITIQUE_SYSTEM_PROMPT;

/**
 * Builds the self-critique user prompt with articles and candidate bullets.
 *
 * @param args - Ticker context, sources, and candidate bullets.
 */
export const buildNewsletterCritiqueUserPrompt = (args: {
  tickerName?: string;
  tickerSymbol?: string;
  sources: readonly SourceForGeneration[];
  candidates: readonly NewsletterCritiqueCandidate[];
}): string => {
  const tickerLabel =
    args.tickerName !== undefined && args.tickerSymbol !== undefined
      ? `${args.tickerName} (${args.tickerSymbol})`
      : (args.tickerName ?? args.tickerSymbol ?? "the sector");

  return [
    `Review bullets for ${tickerLabel}.`,
    "",
    "Articles:",
    formatArticleSummariesForCritique(args.sources),
    "",
    "Candidate bullets (rate every row; use exact sectionKey and bulletIndex):",
    formatNewsletterCritiqueCandidatesBlock(args.candidates),
  ].join("\n");
};

/**
 * Composite score for ranking critique actions (higher is better).
 *
 * @param rating - One critique rating row.
 */
export const critiqueCompositeScore = (
  rating: Pick<
    NewsletterCritiqueRating,
    "specificity" | "citationStrength" | "readerValue" | "redundancy"
  >,
): number =>
  rating.specificity +
  rating.citationStrength +
  rating.readerValue -
  rating.redundancy;

/** Arguments for a newsletter self-critique `generateObject` call. */
export type GenerateObjectForNewsletterCritiqueArgs = {
  model: ReturnType<ReturnType<typeof createOpenAI>>;
  schema: typeof newsletterCritiqueLlmSchema;
  system: string;
  prompt: string;
  maxOutputTokens: number;
  maxRetries: number;
  timeout?: number;
  /** Provider-specific options (e.g. `{ openai: { reasoningEffort } }`). Omit for non-reasoning models. */
  providerOptions?: OpenAiReasoningProviderOptions;
};

/** Injectable wrapper around critique `generateObject` for tests. */
export type GenerateObjectForNewsletterCritique = (
  args: GenerateObjectForNewsletterCritiqueArgs,
) => Promise<{
  object: NewsletterCritiqueResult;
  usage?: { promptTokens?: number; completionTokens?: number };
}>;

const defaultGenerateObjectForNewsletterCritique: GenerateObjectForNewsletterCritique =
  async (args) => {
    const result = await generateObject({
      model: args.model,
      schema: args.schema,
      system: args.system,
      prompt: args.prompt,
      maxRetries: args.maxRetries,
      maxOutputTokens: args.maxOutputTokens,
      ...(args.timeout !== undefined ? { timeout: args.timeout } : {}),
      ...(args.providerOptions !== undefined
        ? { providerOptions: args.providerOptions }
        : {}),
    });
    const usage = result.usage
      ? {
          promptTokens: result.usage.inputTokens,
          completionTokens: result.usage.outputTokens,
        }
      : undefined;
    return { object: result.object, usage };
  };

/**
 * Runs the self-critique LLM pass over candidate bullets.
 *
 * @param params - API credentials, model, prompts, and token limit.
 * @param deps - Injectable `generateObject` wrapper for tests.
 */
export const critiqueNewsletter = async (
  params: {
    apiKey: string;
    baseUrl?: string;
    model: string;
    maxOutputTokens: number;
    system: string;
    prompt: string;
    timeout?: number;
    providerOptions?: OpenAiReasoningProviderOptions;
  },
  deps: {
    generateObjectFn?: GenerateObjectForNewsletterCritique;
  } = {},
): Promise<{
  object: NewsletterCritiqueResult;
  usage: { promptTokens: number | null; completionTokens: number | null };
}> => {
  const generateObjectFn =
    deps.generateObjectFn ?? defaultGenerateObjectForNewsletterCritique;
  const openai = createOpenAI({
    apiKey: params.apiKey,
    ...(params.baseUrl !== undefined ? { baseURL: params.baseUrl } : {}),
  });

  const result = await generateObjectFn({
    model: openai(params.model),
    schema: newsletterCritiqueLlmSchema,
    system: params.system,
    prompt: params.prompt,
    maxOutputTokens: params.maxOutputTokens,
    maxRetries: 0,
    ...(params.timeout !== undefined ? { timeout: params.timeout } : {}),
    ...(params.providerOptions !== undefined
      ? { providerOptions: params.providerOptions }
      : {}),
  });

  return {
    object: result.object,
    usage: {
      promptTokens: result.usage?.promptTokens ?? null,
      completionTokens: result.usage?.completionTokens ?? null,
    },
  };
};

const candidateKey = (sectionKey: string, bulletIndex: number): string =>
  `${sectionKey}:${String(bulletIndex)}`;

/**
 * Applies critique ratings with rewrite preference and schema-floor protection.
 *
 * @param structure - Post-grounding newsletter JSON.
 * @param ratings - Critique model output matched to candidates.
 * @param options - Drop fraction and rewrite preference.
 */
export const applyNewsletterCritiqueResults = (
  structure: IndustryNewsletterStructure,
  ratings: readonly NewsletterCritiqueRating[],
  options: SelfCritiqueApplyOptions,
): {
  structure: IndustryNewsletterStructure;
  summary: Pick<
    NewsletterCritiqueSummary,
    "bulletsRated" | "bulletsRewritten" | "bulletsDropped" | "floorPreserved"
  >;
  p50Specificity: number;
  p50ReaderValue: number;
} => {
  const next = structuredClone(structure);
  const candidates = collectNewsletterCritiqueCandidates(structure);
  const candidateKeys = new Set(
    candidates.map((candidate) =>
      candidateKey(candidate.sectionKey, candidate.bulletIndex),
    ),
  );

  const matchedRatings = ratings.filter((rating) =>
    candidateKeys.has(candidateKey(rating.sectionKey, rating.bulletIndex)),
  );

  const maxActions = Math.floor(candidates.length * options.dropFraction);

  const sortedForAction = [...matchedRatings]
    .filter((rating) => rating.drop)
    .sort((left, right) => {
      const dropOrder = Number(left.drop) - Number(right.drop);
      if (dropOrder !== 0) {
        return dropOrder;
      }
      return critiqueCompositeScore(left) - critiqueCompositeScore(right);
    })
    .slice(0, maxActions);

  const rewriteTargets = new Map<string, string>();
  const dropTargets = new Set<string>();
  let bulletsRewritten = 0;

  for (const rating of sortedForAction) {
    const key = candidateKey(rating.sectionKey, rating.bulletIndex);
    const rewrite = rating.suggestedRewrite?.trim();
    if (
      options.preferRewriteOverDrop &&
      rewrite !== undefined &&
      rewrite.length > 0
    ) {
      rewriteTargets.set(key, rewrite);
      bulletsRewritten += 1;
    } else {
      dropTargets.add(key);
    }
  }

  let floorPreserved = 0;
  for (const sectionKey of new Set(
    [...dropTargets].map((key) => key.split(":")[0] ?? ""),
  )) {
    const minCount = SECTION_MIN_COUNTS[sectionKey];
    if (minCount === undefined) {
      continue;
    }

    const sectionDropKeys = [...dropTargets].filter((key) =>
      key.startsWith(`${sectionKey}:`),
    );
    const sectionCandidates = candidates.filter(
      (candidate) => candidate.sectionKey === sectionKey,
    );
    if (sectionCandidates.length - sectionDropKeys.length < minCount) {
      for (const key of sectionDropKeys) {
        dropTargets.delete(key);
        floorPreserved += 1;
      }
    }
  }

  const applyToBullets = (
    sectionKey: string,
    bullets: Array<{ title: string; text: string; articleIndex?: number }>,
  ): Array<{ title: string; text: string; articleIndex?: number }> => {
    return bullets.flatMap((bullet, bulletIndex) => {
      const key = candidateKey(sectionKey, bulletIndex);
      const rewrite = rewriteTargets.get(key);
      if (rewrite !== undefined) {
        return [{ ...bullet, text: rewrite }];
      }
      if (dropTargets.has(key)) {
        return [];
      }
      return [bullet];
    });
  };

  next.competitiveLandscape.bullets = applyToBullets(
    "competitiveLandscape",
    next.competitiveLandscape.bullets,
  ) as IndustryNewsletterStructure["competitiveLandscape"]["bullets"];

  next.dealsAndMovements.bullets = applyToBullets(
    "dealsAndMovements",
    next.dealsAndMovements.bullets,
  ) as IndustryNewsletterStructure["dealsAndMovements"]["bullets"];

  next.regulatoryPolicyWatch.bullets = applyToBullets(
    "regulatoryPolicyWatch",
    next.regulatoryPolicyWatch.bullets,
  ) as IndustryNewsletterStructure["regulatoryPolicyWatch"]["bullets"];

  if (next.disruptorsOrTech.format === "bullets") {
    const bullets = applyToBullets(
      "disruptorsOrTech.bullets",
      next.disruptorsOrTech.bullets,
    );
    next.disruptorsOrTech = {
      format: "bullets",
      displayHeading: next.disruptorsOrTech.displayHeading,
      bullets,
    };
  }

  next.quickHits.items = next.quickHits.items.flatMap((item, bulletIndex) => {
    const key = candidateKey("quickHits", bulletIndex);
    const rewrite = rewriteTargets.get(key);
    if (rewrite !== undefined) {
      return [{ ...item, text: rewrite }];
    }
    if (dropTargets.has(key)) {
      return [];
    }
    return [item];
  }) as IndustryNewsletterStructure["quickHits"]["items"];

  industryNewsletterStructureSchema.parse(next);

  const bulletsDropped = dropTargets.size;
  const specificityScores = matchedRatings.map((rating) => rating.specificity);
  const readerValueScores = matchedRatings.map((rating) => rating.readerValue);

  return {
    structure: next,
    summary: {
      bulletsRated: matchedRatings.length,
      bulletsRewritten,
      bulletsDropped,
      floorPreserved,
    },
    p50Specificity: percentile(specificityScores, 0.5),
    p50ReaderValue: percentile(readerValueScores, 0.5),
  };
};
