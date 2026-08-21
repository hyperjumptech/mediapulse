import { MAX_POINT_LENGTH } from "@workspace/email-templates/newsletter-document";

/** Why a generated point was withheld from the newsletter. */
export type DroppedPointReason =
  | "non_latin_script"
  | "truncated"
  | "starts_mid_sentence"
  | "figure_without_subject"
  | "fetch_failure"
  | "no_substance";

/** One point removed by {@link sanitizeSummaryPoints}, kept for logging. */
export type DroppedPoint = {
  point: string;
  reason: DroppedPointReason;
};

export type SanitizeSummaryPointsResult = {
  points: string[];
  dropped: DroppedPoint[];
};

/**
 * Scripts that never belong in an English bullet. The summarizer occasionally emits a Han or
 * Kana token mid-sentence when the source article is Indonesian, which ships as visibly broken
 * prose ("safeguarding矿业", "at least three月").
 */
const NON_LATIN_SCRIPT_PATTERN =
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Arabic}\p{Script=Cyrillic}\p{Script=Thai}\p{Script=Devanagari}]/u;

/** Characters that can legitimately end a complete point. */
const COMPLETE_ENDING_PATTERN = /[.!?%)\]"'’”]$/u;

/**
 * Machinery of a failed fetch rather than news: CDN names, HTTP status text, and block pages. The
 * summarizer sometimes describes the error page it was handed instead of refusing the article,
 * which ships as "Website x shows error code 520 and cannot display page content".
 */
const PAGE_ARTIFACT_PATTERN =
  /\b(?:cloudflare|origin web server|error code\s*\d{3}|http\s*\d{3}|status code\s*\d{3}|\d{3}\s*(?:error|forbidden|not found)|page (?:not found|cannot be displayed|could not be loaded)|cannot display (?:the )?page|website error|connection (?:issue|error|refused|timed out)|access denied|subscription required|paywall|captcha|enable javascript|javascript is required)\b/iu;

/**
 * An article, page, or source described as missing. Anchored on the page noun so a company
 * genuinely reported as unavailable is not caught. "Site" is deliberately absent from the noun
 * list, since an industrial or plant site is unavailable for ordinary business reasons.
 */
const MISSING_CONTENT_PATTERN =
  /\b(?:article|page|website|webpage|source|content|url|link)\b[^.]{0,60}?\b(?:not found|unavailable|not available|could not be (?:retrieved|loaded|accessed)|failed to load|inaccessible)\b/iu;

/**
 * Summarizer meta-language conceding it found nothing, as in "No detailed information on the
 * expansion available". "Disclosed" is deliberately excluded so the ordinary deal-reporting line
 * "no financial details were disclosed" still ships.
 */
const NO_INFORMATION_PATTERN =
  /^\s*no\s+(?:\w+\s+){0,3}?(?:information|details|data|facts)\b[^.]*\b(?:available|found|provided|retrieved)\b/iu;

const ABSENT_INFORMATION_PATTERN =
  /\b(?:not\s+(?:detailed|specified|elaborated|stated|explained|mentioned|quantified)|no\s+further\s+(?:details?|information|explanation)|(?:remains?|is|are|was|were)\s+unclear|(?:does|do|did)\s+not\s+(?:say|specify|state|detail|explain|elaborate|mention))\b/iu;

const VACUOUS_ASSERTION_PATTERN =
  /\b(?:(?:significant|considerable|substantial|strong|great|huge)\s+(?:growth\s+)?potential|requires?\s+(?:a\s+|an\s+)?strategic\s+(?:approach(?:es)?|step(?:s)?)|still\s+has\s+(?:significant|considerable|substantial|room))\b/iu;

/**
 * Words a complete point never ends on. A point stopping here was cut mid-clause even when it
 * sits well inside the character budget.
 */
const DANGLING_TRAILING_WORDS = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "by",
  "for",
  "from",
  "in",
  "into",
  "of",
  "on",
  "or",
  "per",
  "the",
  "to",
  "via",
  "with",
]);

/**
 * Characters of slack below {@link MAX_POINT_LENGTH} within which an unterminated point is read
 * as having hit the budget mid-word rather than ending on a deliberate short phrase.
 */
const BUDGET_EDGE_SLACK = 3;

const lastWordOf = (point: string): string => {
  const words = point.trim().toLowerCase().split(/[\s]+/u);

  return (words[words.length - 1] ?? "").replaceAll(/[^a-z]/gu, "");
};

/**
 * Reports whether a point reads as cut off rather than finished.
 *
 * Two signals: it ran into the character budget without a terminal character, or it ends on a
 * word no complete sentence ends on.
 *
 * @param point - One generated summary point.
 */
export const looksTruncated = (point: string): boolean => {
  const trimmed = point.trim();
  if (trimmed.length === 0) {
    return false;
  }

  if (DANGLING_TRAILING_WORDS.has(lastWordOf(trimmed))) {
    return true;
  }

  const atBudgetEdge = trimmed.length >= MAX_POINT_LENGTH - BUDGET_EDGE_SLACK;

  return atBudgetEdge && !COMPLETE_ENDING_PATTERN.test(trimmed);
};

/**
 * Reports whether a point opens partway through a sentence.
 *
 * A complete point starts on a capital or a digit. One starting on an all-lowercase word lost its
 * subject, as in "manages universal service obligation financing" or "and satellite to support
 * national digital transformation". A first word carrying an interior capital is a brand
 * (`iPhone`, `eFishery`) and is left alone. A digit-led point that lost its subject is caught by
 * {@link startsWithUnanchoredFigure} instead.
 *
 * @param point - One generated summary point.
 */
export const startsMidSentence = (point: string): boolean => {
  const firstWord = point.trim().split(/\s+/u)[0] ?? "";
  if (firstWord.length === 0) {
    return false;
  }

  return /^\p{Ll}/u.test(firstWord) && !/\p{Lu}/u.test(firstWord);
};

const LEADING_FIGURE_PATTERN =
  /^(?:rp|idr|usd|us\$|\$|eur|€|sgd|myr|jpy|¥|£|gbp)?\s*\d[\d.,]*\s*(?:%|persen|percent|pct|triliun|trilyun|trillion|miliar|milyar|billion|juta|million|ribu|thousand|bn|mn|k)?$/iu;

const SUBJECT_ANCHOR_WINDOW = 6;

const bareWord = (word: string): string =>
  word.replaceAll(/[^\p{L}]/gu, "").toLowerCase();

export const startsWithUnanchoredFigure = (point: string): boolean => {
  const words = point.trim().split(/\s+/u);
  const leading = words[0];
  if (leading === undefined || !LEADING_FIGURE_PATTERN.test(leading)) {
    return false;
  }
  if (bareWord(words[1] ?? "") === "of") {
    return false;
  }

  return !words
    .slice(1, SUBJECT_ANCHOR_WINDOW)
    .some((word) => /\p{Lu}/u.test(word));
};

/**
 * Reports whether a point carries characters outside the Latin script.
 *
 * @param point - One generated summary point.
 */
export const containsNonLatinScript = (point: string): boolean =>
  NON_LATIN_SCRIPT_PATTERN.test(point);

/**
 * Reports whether a point describes a failed fetch instead of the article's subject.
 *
 * @param point - One generated summary point.
 */
export const describesFetchFailure = (point: string): boolean =>
  PAGE_ARTIFACT_PATTERN.test(point) ||
  MISSING_CONTENT_PATTERN.test(point) ||
  NO_INFORMATION_PATTERN.test(point);

/**
 * Reports whether a point states an absence of information or asserts nothing checkable.
 *
 * @param point - One generated summary point.
 */
export const lacksSubstance = (point: string): boolean =>
  ABSENT_INFORMATION_PATTERN.test(point) ||
  VACUOUS_ASSERTION_PATTERN.test(point);

/**
 * Removes points that would ship as visibly broken text or as no news at all: a stray non-Latin
 * glyph, a sentence cut off mid-word against the length budget, a description of a failed fetch
 * rather than of the article, or an assertion carrying nothing the reader can act on.
 *
 * Dropping the point rather than the article keeps the rest of a good summary. A caller that
 * receives an empty result should treat the article as failed, since a rendered article with no
 * points is worse than one absent article. An article built entirely from an error page loses
 * every point here and so drops out.
 *
 * @param points - Points returned by the summarizer.
 * @returns The points safe to render, plus what was dropped and why.
 */
export const sanitizeSummaryPoints = (
  points: readonly string[],
): SanitizeSummaryPointsResult => {
  const kept: string[] = [];
  const dropped: DroppedPoint[] = [];

  for (const point of points) {
    if (containsNonLatinScript(point)) {
      dropped.push({ point, reason: "non_latin_script" });
      continue;
    }
    if (looksTruncated(point)) {
      dropped.push({ point, reason: "truncated" });
      continue;
    }
    if (startsMidSentence(point)) {
      dropped.push({ point, reason: "starts_mid_sentence" });
      continue;
    }
    if (startsWithUnanchoredFigure(point)) {
      dropped.push({ point, reason: "figure_without_subject" });
      continue;
    }
    if (describesFetchFailure(point)) {
      dropped.push({ point, reason: "fetch_failure" });
      continue;
    }
    if (lacksSubstance(point)) {
      dropped.push({ point, reason: "no_substance" });
      continue;
    }
    kept.push(point);
  }

  return { points: kept, dropped };
};
