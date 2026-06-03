import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import type { OpenAiReasoningProviderOptions } from "@workspace/agent-runtime";
import { z } from "zod";

import {
  buildWordShingles,
  shingleJaccardSimilarity,
} from "./citation-grounding.js";
import { tokenize } from "./phrase-link-injector.js";

/** Stylistic label for a generated subject candidate. */
export type SubjectCandidateStyle =
  | "declarative"
  | "question"
  | "curiosity"
  | "numeric"
  | "contrast";

/** One subject + preheader pair from the candidate LLM pass. */
export type SubjectCandidate = {
  subject: string;
  style: SubjectCandidateStyle;
  preheader: string;
};

/** Per-axis score breakdown for a subject candidate. */
export type SubjectScoreComponents = {
  lengthFit: number;
  tickerPresence: number;
  curiosityGap: number;
  novelty: number;
  readability: number;
};

/** Weighted score for one subject candidate. */
export type SubjectScore = {
  candidate: SubjectCandidate;
  score: number;
  components: SubjectScoreComponents;
};

/** Tunable weights for the five scoring axes (should sum to ~1). */
export type SubjectLineWeights = {
  lengthFit: number;
  tickerPresence: number;
  curiosityGap: number;
  novelty: number;
  readability: number;
};

/** Default axis weights for subject-line ranking. */
export const DEFAULT_SUBJECT_LINE_WEIGHTS: SubjectLineWeights = {
  lengthFit: 0.2,
  tickerPresence: 0.15,
  curiosityGap: 0.25,
  novelty: 0.2,
  readability: 0.2,
};

/** Context passed into subject scoring and selection. */
export type SubjectLineScoringContext = {
  tickerSymbol?: string;
  tickerName?: string;
  weights: SubjectLineWeights;
};

/** Result of picking the best subject among candidates and the original. */
export type PickBestSubjectResult = {
  winnerSubject: string;
  winnerPreheader: string;
  winnerScore: number;
  originalScore: number;
  rankedTable: SubjectScore[];
};

export const subjectCandidateStyleSchema = z.enum([
  "declarative",
  "question",
  "curiosity",
  "numeric",
  "contrast",
]);

export const subjectCandidateSchema = z.object({
  subject: z.string().min(1).max(60),
  style: subjectCandidateStyleSchema,
  preheader: z.string().min(1).max(110),
});

/** JSON shape returned by the subject-candidate LLM pass. */
export const subjectCandidatesSchema = z.object({
  candidates: z.array(subjectCandidateSchema).min(3).max(8),
});

export type SubjectCandidatesResult = z.infer<typeof subjectCandidatesSchema>;

const CLICKBAIT_PATTERN = /\b(shocking|unbelievable|mind-blowing)\b/i;

const GENERIC_TICKER_REFERENCE_PATTERN =
  /\b(the bank|the conglomerate|the group|the company|perusahaan|grup|bank tersebut)\b/i;

const LENGTH_PEAK = 42;
const LENGTH_MIN = 8;
const LENGTH_MAX = 70;

const NOVELTY_FLOOR = 0.6;

/**
 * Scores subject length on a triangular curve peaking at 42 characters.
 *
 * @param subject - Email subject line.
 */
export const scoreLengthFit = (subject: string): number => {
  const length = subject.length;
  if (length <= LENGTH_MIN || length >= LENGTH_MAX) {
    return 0;
  }
  if (length === LENGTH_PEAK) {
    return 1;
  }
  if (length < LENGTH_PEAK) {
    return (length - LENGTH_MIN) / (LENGTH_PEAK - LENGTH_MIN);
  }
  return (LENGTH_MAX - length) / (LENGTH_MAX - LENGTH_PEAK);
};

/**
 * Estimates syllable count via vowel clusters (English/Indonesian heuristic).
 *
 * @param word - Single token.
 */
export const estimateSyllableCount = (word: string): number => {
  const clusters = word.match(/[aeiouyAEIOUY]+/g);
  return Math.max(1, clusters?.length ?? 1);
};

/**
 * Scores readability as `1 - min(1, meanSyllables / 4)`.
 *
 * @param subject - Email subject line.
 */
export const scoreReadability = (subject: string): number => {
  const words = subject
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0);
  if (words.length === 0) {
    return 0;
  }

  const meanSyllables =
    words.reduce((sum, word) => sum + estimateSyllableCount(word), 0) /
    words.length;

  return 1 - Math.min(1, meanSyllables / 4);
};

/**
 * Scores ticker/symbol presence in the subject line.
 *
 * @param subject - Email subject line.
 * @param tickerSymbol - Exchange symbol when available.
 * @param tickerName - Human-readable company name when available.
 */
export const scoreTickerPresence = (
  subject: string,
  tickerSymbol?: string,
  tickerName?: string,
): number => {
  const lower = subject.toLowerCase();

  if (GENERIC_TICKER_REFERENCE_PATTERN.test(subject)) {
    return 0.7;
  }

  if (
    tickerSymbol !== undefined &&
    tickerSymbol.trim().length > 0 &&
    lower.includes(tickerSymbol.toLowerCase())
  ) {
    return 1;
  }

  if (tickerName !== undefined && tickerName.trim().length > 0) {
    const nameTokens = tickerName
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 3);
    if (nameTokens.some((token) => lower.includes(token.toLowerCase()))) {
      return 1;
    }
  }

  return 0.3;
};

/**
 * Scores curiosity-gap patterns; penalizes clickbait phrases.
 *
 * @param subject - Email subject line.
 */
export const scoreCuriosityGap = (subject: string): number => {
  let score = 0;

  if (subject.trimEnd().endsWith("?")) {
    score += 0.2;
  }
  if (/\d/.test(subject)) {
    score += 0.2;
  }
  if (/\b(but|yet|while|kecuali|tapi)\b/i.test(subject)) {
    score += 0.2;
  }
  if (/\b(why|how|mengapa)\b/i.test(subject)) {
    score += 0.2;
  }
  if (CLICKBAIT_PATTERN.test(subject)) {
    score -= 0.4;
  }

  return Math.max(0, Math.min(1, score));
};

/**
 * Scores novelty vs recent subjects using 3-gram Jaccard similarity.
 *
 * @param subject - Email subject line.
 * @param recentSubjects - Subjects from the last N days for this ticker.
 */
export const scoreNoveltyVsHistory = (
  subject: string,
  recentSubjects: readonly string[],
): number => {
  if (recentSubjects.length === 0) {
    return 1;
  }

  const subjectShingles = buildWordShingles(tokenize(subject));
  let maxSimilarity = 0;

  for (const recent of recentSubjects) {
    const recentShingles = buildWordShingles(tokenize(recent));
    maxSimilarity = Math.max(
      maxSimilarity,
      shingleJaccardSimilarity(subjectShingles, recentShingles),
    );
  }

  return Math.max(NOVELTY_FLOOR, 1 - maxSimilarity);
};

/**
 * Builds a default preheader from industry pulse prose (first 110 chars).
 *
 * @param prose - Lead paragraph from the structured briefing.
 */
export const buildOriginalPreheader = (prose: string): string => {
  const trimmed = prose.trim();
  if (trimmed.length <= 110) {
    return trimmed;
  }
  return trimmed.slice(0, 110);
};

/**
 * Computes the weighted composite score for one subject candidate.
 *
 * @param candidate - Subject + preheader pair.
 * @param ctx - Ticker context and axis weights.
 * @param recentSubjects - Recent subjects for novelty scoring.
 */
export const scoreSubjectCandidate = (
  candidate: SubjectCandidate,
  ctx: SubjectLineScoringContext,
  recentSubjects: readonly string[],
): SubjectScore => {
  const components: SubjectScoreComponents = {
    lengthFit: scoreLengthFit(candidate.subject),
    tickerPresence: scoreTickerPresence(
      candidate.subject,
      ctx.tickerSymbol,
      ctx.tickerName,
    ),
    curiosityGap: scoreCuriosityGap(candidate.subject),
    novelty: scoreNoveltyVsHistory(candidate.subject, recentSubjects),
    readability: scoreReadability(candidate.subject),
  };

  const weights = ctx.weights;
  const score =
    components.lengthFit * weights.lengthFit +
    components.tickerPresence * weights.tickerPresence +
    components.curiosityGap * weights.curiosityGap +
    components.novelty * weights.novelty +
    components.readability * weights.readability;

  return { candidate, score, components };
};

/**
 * Picks the highest-scoring subject; the original wins on ties.
 *
 * @param candidates - LLM-generated subject candidates.
 * @param originalSubject - Subject from the main structured generation pass.
 * @param industryPulseProse - Lead prose used to derive the original preheader.
 * @param ctx - Scoring context including recent subjects and weights.
 */
export const pickBestSubject = (
  candidates: readonly SubjectCandidate[],
  originalSubject: string,
  industryPulseProse: string,
  ctx: SubjectLineScoringContext & { recentSubjects: readonly string[] },
): PickBestSubjectResult => {
  const originalCandidate: SubjectCandidate = {
    subject: originalSubject,
    style: "declarative",
    preheader: buildOriginalPreheader(industryPulseProse),
  };

  const scored = [
    scoreSubjectCandidate(originalCandidate, ctx, ctx.recentSubjects),
    ...candidates.map((candidate) =>
      scoreSubjectCandidate(candidate, ctx, ctx.recentSubjects),
    ),
  ];

  const originalScore = scored[0]!.score;

  let winner = scored[0]!;
  for (const row of scored.slice(1)) {
    if (row.score > winner.score) {
      winner = row;
    }
  }

  const rankedTable = [...scored].sort(
    (left, right) => right.score - left.score,
  );

  return {
    winnerSubject: winner.candidate.subject,
    winnerPreheader: winner.candidate.preheader,
    winnerScore: winner.score,
    originalScore,
    rankedTable,
  };
};

export type BuildSubjectCandidatePromptParams = {
  tickerName?: string;
  tickerSymbol?: string;
  primarySubject: string;
  candidateCount: number;
  brainstormText?: string;
};

/**
 * Builds the system prompt for the subject-candidate LLM pass.
 *
 * @param candidateCount - Target number of candidates to request.
 */
export const buildSubjectCandidateSystemPrompt = (
  candidateCount: number,
): string =>
  [
    "You write email subject lines for an industry briefing.",
    `Produce exactly ${String(candidateCount)} candidate subjects, each at most 60 characters,`,
    "plus a 50–110 character preheader (preview line shown after the subject in most inboxes).",
    "Avoid clickbait, exclamation marks, ALL-CAPS, and emoji.",
    "Style mix: at least one declarative, one with a number, one curiosity-gap, one with a contrast.",
    "Cite the ticker name or symbol naturally when it fits — never twice in one subject.",
    'Return JSON: { "candidates": [ { "subject", "style", "preheader" }, ... ] }.',
    "style must be one of: declarative, question, curiosity, numeric, contrast.",
  ].join(" ");

/**
 * Builds the user prompt for subject-candidate generation.
 *
 * @param params - Briefing context and the primary subject from structured generation.
 */
export const buildSubjectCandidatePrompt = (
  params: BuildSubjectCandidatePromptParams,
): string => {
  const lines = [
    `Ticker: ${params.tickerName ?? "unknown"} (${params.tickerSymbol ?? "unknown"})`,
    `Primary subject from the briefing draft: ${params.primarySubject}`,
    `Generate ${String(params.candidateCount)} alternative subjects with preheaders.`,
  ];

  if (
    params.brainstormText !== undefined &&
    params.brainstormText.trim().length > 0
  ) {
    lines.push(
      "",
      "Editor memo (for angle, not verbatim copy):",
      params.brainstormText.trim(),
    );
  }

  return lines.join("\n");
};

/** Arguments for a subject-candidate `generateObject` call. */
export type GenerateObjectForSubjectCandidatesArgs = {
  model: ReturnType<ReturnType<typeof createOpenAI>>;
  schema: typeof subjectCandidatesSchema;
  system: string;
  prompt: string;
  maxRetries: number;
  timeout?: number;
  /** Provider-specific options (e.g. `{ openai: { reasoningEffort } }`). Omit for non-reasoning models. */
  providerOptions?: OpenAiReasoningProviderOptions;
};

/** Injectable wrapper around subject-candidate `generateObject` for tests. */
export type GenerateObjectForSubjectCandidates = (
  args: GenerateObjectForSubjectCandidatesArgs,
) => Promise<{
  object: SubjectCandidatesResult;
  usage?: { promptTokens?: number; completionTokens?: number };
}>;

const defaultGenerateObjectForSubjectCandidates: GenerateObjectForSubjectCandidates =
  async (args) => {
    const result = await generateObject({
      model: args.model,
      schema: args.schema,
      system: args.system,
      prompt: args.prompt,
      maxRetries: args.maxRetries,
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
 * Fetches subject-line candidates from a small sidecar LLM call.
 *
 * @param params - API credentials, model, prompts, and timeout.
 * @param deps - Injectable `generateObject` wrapper for tests.
 */
export const fetchSubjectCandidates = async (
  params: {
    apiKey: string;
    baseUrl?: string;
    model: string;
    candidateCount: number;
    system: string;
    prompt: string;
    timeout?: number;
    providerOptions?: OpenAiReasoningProviderOptions;
  },
  deps: {
    generateObjectFn?: GenerateObjectForSubjectCandidates;
  } = {},
): Promise<{
  object: SubjectCandidatesResult;
  usage: { promptTokens: number | null; completionTokens: number | null };
}> => {
  const generateObjectFn =
    deps.generateObjectFn ?? defaultGenerateObjectForSubjectCandidates;
  const openai = createOpenAI({
    apiKey: params.apiKey,
    ...(params.baseUrl !== undefined ? { baseURL: params.baseUrl } : {}),
  });

  const result = await generateObjectFn({
    model: openai(params.model),
    schema: subjectCandidatesSchema,
    system: params.system,
    prompt: params.prompt,
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

/** Rolled-up subject-line selection metrics for logs and run details. */
export type SubjectLineSummary = {
  originalSubject: string;
  winnerSubject: string;
  winnerScore: number;
  originalScore: number;
  candidateCount: number;
  candidateScores: Array<{
    subject: string;
    style: SubjectCandidateStyle;
    score: number;
  }>;
  promptTokens: number | null;
  completionTokens: number | null;
};
