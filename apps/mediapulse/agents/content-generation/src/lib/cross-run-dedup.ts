import type { AgentDataApiClient } from "@workspace/agent-data-api-client";

import type { IndustryNewsletterStructure } from "../industry-newsletter-schema.js";
import { industryNewsletterStructureSchema } from "../industry-newsletter-schema.js";
import {
  buildWordShingles,
  percentile,
  shingleJaccardSimilarity,
} from "./citation-grounding.js";
import { tokenize } from "./phrase-link-injector.js";

/** One bullet row from a persisted newsletter wire body. */
export type RecentBullet = {
  newsletterId: string;
  sectionKey: string;
  bulletText: string;
  createdAt: string;
};

/** Outcome of comparing one new bullet against the recent corpus. */
export type DuplicateDecision =
  | { kind: "unique" }
  | {
      kind: "near_duplicate";
      matchedNewsletterId: string;
      matchedBulletText: string;
      similarity: number;
    };

/** Per-bullet dedup outcome for observability. */
export type DedupReport = {
  sectionKey: string;
  bulletIndex: number;
  decision: DuplicateDecision;
};

export type CrossRunDedupPolicy = "warn" | "mark" | "drop";

export type DedupBulletsOptions = {
  policy: CrossRunDedupPolicy;
  minSimilarity: number;
  lowInfoDayThreshold: number;
};

export type DedupBulletsResult = {
  structure: IndustryNewsletterStructure;
  reports: DedupReport[];
  lowInformationDay: boolean;
  floorPreserved: number;
  similarities: number[];
  nearDuplicates: number;
  droppedByDedup: number;
  markedByDedup: number;
};

const FOLLOW_UP_PREFIX = "[follow-up] ";
const PROMPT_AVOIDANCE_LIMIT = 15;
const MAX_RECENT_BULLETS = 200;

const SECTION_MIN_COUNTS: Partial<Record<string, number>> = {
  competitiveLandscape: 2,
  dealsAndMovements: 1,
  regulatoryPolicyWatch: 1,
  "disruptorsOrTech.bullets": 1,
  quickHits: 5,
};

type PendingBulletRow = {
  sectionKey: string;
  bulletIndex: number;
  text: string;
  articleIndex?: number;
};

/**
 * Loads recent flattened bullets for a ticker (capped at 200).
 *
 * @param client - Typed agent-data-api client.
 * @param tickerId - Ticker to scope history.
 * @param days - Lookback window in calendar days.
 */
export const loadRecentBulletsForTicker = async (
  client: Pick<AgentDataApiClient, "contentGenerationBulletsRecent">,
  tickerId: string,
  days: number = 14,
): Promise<RecentBullet[]> => {
  const result = await client.contentGenerationBulletsRecent.get({
    tickerId,
    days,
  });
  return result.items.slice(0, MAX_RECENT_BULLETS);
};

/**
 * Scores similarity between two bullet strings using 3-gram Jaccard over content words.
 *
 * @param left - New or corpus bullet text.
 * @param right - Corpus bullet text.
 */
export const scoreBulletSimilarity = (left: string, right: string): number => {
  const leftShingles = buildWordShingles(tokenize(left));
  const rightShingles = buildWordShingles(tokenize(right));
  return shingleJaccardSimilarity(leftShingles, rightShingles);
};

/**
 * Finds the best corpus match for a bullet and returns a duplicate decision.
 *
 * @param bulletText - Generated bullet text.
 * @param recentBullets - Recent corpus rows.
 * @param minSimilarity - Threshold for near-duplicate classification.
 */
export const classifyBulletAgainstCorpus = (
  bulletText: string,
  recentBullets: readonly RecentBullet[],
  minSimilarity: number,
): DuplicateDecision => {
  let bestSimilarity = 0;
  let bestMatch: RecentBullet | undefined;

  for (const recent of recentBullets) {
    const similarity = scoreBulletSimilarity(bulletText, recent.bulletText);
    if (similarity > bestSimilarity) {
      bestSimilarity = similarity;
      bestMatch = recent;
    }
  }

  if (bestMatch !== undefined && bestSimilarity >= minSimilarity) {
    return {
      kind: "near_duplicate",
      matchedNewsletterId: bestMatch.newsletterId,
      matchedBulletText: bestMatch.bulletText,
      similarity: bestSimilarity,
    };
  }

  return { kind: "unique" };
};

/**
 * Renders the preventive "avoid recent bullets" block for the user prompt.
 *
 * @param recentBullets - Flattened bullets from prior newsletters.
 * @param windowDays - Configured lookback window.
 * @param limit - Maximum lines to include (default 15).
 */
export const formatRecentBulletsAvoidanceBlock = (
  recentBullets: readonly RecentBullet[],
  windowDays: number,
  limit: number = PROMPT_AVOIDANCE_LIMIT,
): string => {
  if (recentBullets.length === 0) {
    return "";
  }

  const sorted = [...recentBullets].sort(
    (left, right) =>
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );
  const lines = sorted
    .slice(0, limit)
    .map((bullet) => `- ${bullet.bulletText}`);

  return [
    `AVOID REPEATING THESE RECENT BULLETS (last ${String(windowDays)} days):`,
    ...lines,
    "Write fresh angles or follow-up developments, not restatements.",
  ].join("\n");
};

const stripFollowUpPrefix = (text: string): string =>
  text.startsWith(FOLLOW_UP_PREFIX)
    ? text.slice(FOLLOW_UP_PREFIX.length)
    : text;

const applyMarkToText = (text: string): string => {
  if (text.startsWith(FOLLOW_UP_PREFIX)) {
    return text;
  }
  return `${FOLLOW_UP_PREFIX}${text}`;
};

/**
 * Walks generated bullets, compares against recent corpus, and applies dedup policy.
 *
 * @param structure - Validated newsletter JSON from the structured LLM pass.
 * @param recentBullets - Recent bullet corpus (prior runs only).
 * @param opts - Policy and similarity thresholds.
 */
export const dedupBullets = (
  structure: IndustryNewsletterStructure,
  recentBullets: readonly RecentBullet[],
  opts: DedupBulletsOptions,
): DedupBulletsResult => {
  const next = structuredClone(structure);
  const pending: PendingBulletRow[] = [];
  const reports: DedupReport[] = [];
  const similarities: number[] = [];

  const queueBulletArray = (
    sectionKey: string,
    bullets: Array<{ text: string; articleIndex?: number }>,
  ) => {
    bullets.forEach((bullet, bulletIndex) => {
      pending.push({
        sectionKey,
        bulletIndex,
        text: bullet.text,
        ...(bullet.articleIndex !== undefined
          ? { articleIndex: bullet.articleIndex }
          : {}),
      });
    });
  };

  queueBulletArray("competitiveLandscape", next.competitiveLandscape.bullets);
  queueBulletArray("dealsAndMovements", next.dealsAndMovements.bullets);
  queueBulletArray("regulatoryPolicyWatch", next.regulatoryPolicyWatch.bullets);

  if (next.disruptorsOrTech.format === "bullets") {
    queueBulletArray("disruptorsOrTech.bullets", next.disruptorsOrTech.bullets);
  }

  next.quickHits.items.forEach((item, bulletIndex) => {
    pending.push({
      sectionKey: "quickHits",
      bulletIndex,
      text: item.text,
      articleIndex: item.articleIndex,
    });
  });

  const initialDecisions = new Map<string, DuplicateDecision>();
  for (const row of pending) {
    const decision = classifyBulletAgainstCorpus(
      stripFollowUpPrefix(row.text),
      recentBullets,
      opts.minSimilarity,
    );
    initialDecisions.set(
      `${row.sectionKey}:${String(row.bulletIndex)}`,
      decision,
    );
    if (decision.kind === "near_duplicate") {
      similarities.push(decision.similarity);
    } else {
      similarities.push(0);
    }
  }

  type Action = "pass" | "mark" | "drop";
  const actions = new Map<string, Action>();

  for (const row of pending) {
    const key = `${row.sectionKey}:${String(row.bulletIndex)}`;
    const decision = initialDecisions.get(key) ?? { kind: "unique" as const };
    if (decision.kind === "unique") {
      actions.set(key, "pass");
      continue;
    }
    if (opts.policy === "warn") {
      actions.set(key, "pass");
      continue;
    }
    if (opts.policy === "mark") {
      actions.set(key, "mark");
      continue;
    }
    actions.set(key, "drop");
  }

  let floorPreserved = 0;
  let quickHitsKeptDespiteDedup = 0;

  for (const [sectionKey, minCount] of Object.entries(SECTION_MIN_COUNTS)) {
    const sectionRows = pending.filter((row) => row.sectionKey === sectionKey);
    const dropKeys = sectionRows
      .filter(
        (row) =>
          actions.get(`${row.sectionKey}:${String(row.bulletIndex)}`) ===
          "drop",
      )
      .map((row) => `${row.sectionKey}:${String(row.bulletIndex)}`);

    if (sectionRows.length - dropKeys.length < (minCount ?? 0)) {
      for (const key of dropKeys) {
        const row = sectionRows.find(
          (candidate) =>
            `${candidate.sectionKey}:${String(candidate.bulletIndex)}` === key,
        );
        if (row === undefined) {
          continue;
        }
        if (sectionKey === "quickHits") {
          actions.set(key, "pass");
          quickHitsKeptDespiteDedup += 1;
        } else {
          actions.set(key, "mark");
          floorPreserved += 1;
        }
      }
    }
  }

  let droppedByDedup = 0;
  let markedByDedup = 0;

  const applyBulletArray = (
    sectionKey: string,
    bullets: Array<{ title: string; text: string; articleIndex?: number }>,
  ): Array<{ title: string; text: string; articleIndex?: number }> => {
    return bullets.flatMap((bullet, bulletIndex) => {
      const key = `${sectionKey}:${String(bulletIndex)}`;
      const decision = initialDecisions.get(key) ?? { kind: "unique" as const };
      const action = actions.get(key) ?? "pass";

      reports.push({
        sectionKey,
        bulletIndex,
        decision,
      });

      if (action === "drop") {
        droppedByDedup += 1;
        return [];
      }
      if (action === "mark") {
        markedByDedup += 1;
        return [
          {
            ...bullet,
            text: applyMarkToText(bullet.text),
          },
        ];
      }
      return [bullet];
    });
  };

  next.competitiveLandscape.bullets = applyBulletArray(
    "competitiveLandscape",
    next.competitiveLandscape.bullets,
  ) as IndustryNewsletterStructure["competitiveLandscape"]["bullets"];
  next.dealsAndMovements.bullets = applyBulletArray(
    "dealsAndMovements",
    next.dealsAndMovements.bullets,
  ) as IndustryNewsletterStructure["dealsAndMovements"]["bullets"];
  next.regulatoryPolicyWatch.bullets = applyBulletArray(
    "regulatoryPolicyWatch",
    next.regulatoryPolicyWatch.bullets,
  ) as IndustryNewsletterStructure["regulatoryPolicyWatch"]["bullets"];

  if (next.disruptorsOrTech.format === "bullets") {
    const bullets = applyBulletArray(
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
    const key = `quickHits:${String(bulletIndex)}`;
    const decision = initialDecisions.get(key) ?? { kind: "unique" as const };
    const action = actions.get(key) ?? "pass";

    reports.push({
      sectionKey: "quickHits",
      bulletIndex,
      decision,
    });

    if (action === "drop") {
      droppedByDedup += 1;
      return [];
    }
    if (action === "mark") {
      markedByDedup += 1;
      return [{ ...item, text: applyMarkToText(item.text) }];
    }
    return [item];
  }) as IndustryNewsletterStructure["quickHits"]["items"];

  industryNewsletterStructureSchema.parse(next);

  const nearDuplicates = reports.filter(
    (report) => report.decision.kind === "near_duplicate",
  ).length;
  const comparableBullets = reports.length;
  const lowInformationDay =
    comparableBullets > 0 &&
    nearDuplicates / comparableBullets > opts.lowInfoDayThreshold;

  return {
    structure: next,
    reports,
    lowInformationDay,
    floorPreserved,
    similarities,
    nearDuplicates,
    droppedByDedup,
    markedByDedup,
  };
};

/**
 * Builds rolled-up dedup observability counters for logging.
 *
 * @param result - Output from {@link dedupBullets}.
 * @param recentBulletCount - Size of the corpus used for comparison.
 */
export const buildCrossRunDedupObservability = (
  result: DedupBulletsResult,
  recentBulletCount: number,
): {
  recentBulletCount: number;
  bulletsCompared: number;
  nearDuplicates: number;
  droppedByDedup: number;
  markedByDedup: number;
  p50Similarity: number;
  p95Similarity: number;
  lowInformationDay: boolean;
  floorPreserved: number;
} => ({
  recentBulletCount,
  bulletsCompared: result.reports.length,
  nearDuplicates: result.nearDuplicates,
  droppedByDedup: result.droppedByDedup,
  markedByDedup: result.markedByDedup,
  p50Similarity: percentile(result.similarities, 0.5),
  p95Similarity: percentile(result.similarities, 0.95),
  lowInformationDay: result.lowInformationDay,
  floorPreserved: result.floorPreserved,
});
