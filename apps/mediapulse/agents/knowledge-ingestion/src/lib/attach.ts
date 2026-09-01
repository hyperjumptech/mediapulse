import {
  containment,
  distinctiveAnchorTokens,
  extractFigures,
  sharedCount,
  tokenize,
} from "@workspace/utils";

/**
 * Characters of body text compared when deciding whether two articles report one move. Bounded to
 * the lead paragraphs because that is the part a summary is drawn from, and because an unbounded
 * body swamps every similarity measure with filler.
 */
export const COMPARISON_CHAR_LIMIT = 300;

export const TITLE_CHAR_LIMIT = 300;

/** Minimum shared anchors before two articles are treated as reporting the same move. */
export const MIN_SHARED_ANCHORS = 4;

/** Minimum anchor containment alongside the shared-count guard. */
export const MIN_CONTAINMENT = 0.4;

/** Same-day headline path, for two outlets whose lead paragraphs diverge but whose headlines do not. */
export const TITLE_MIN_SHARED_ANCHORS = 3;

export const TITLE_MIN_CONTAINMENT = 0.4;

/**
 * Share of a candidate's anchors a Storyline must already hold before the candidate may join it.
 *
 * - Important: this is the guard against chained attachment. Matching one Development is not enough,
 *   because A can resemble B and B resemble C while A and C share nothing. Requiring the candidate
 *   to overlap the thread as a whole is what stops a group swallowing an unrelated corpus.
 */
export const STORYLINE_MIN_CONTAINMENT = 0.5;

/**
 * Containment against the matched Development above which a candidate is the same move rather than
 * the next one. Paired with the figure test: a candidate carrying a figure the move has never
 * reported is new information, however similar its wording.
 */
export const SAME_MOVE_CONTAINMENT = 0.6;

export type Candidate = {
  dataSourceId: string;
  title: string;
  text: string;
  publishedDay?: string;
};

export type CandidateAnchors = {
  anchors: Set<string>;
  titleAnchors: Set<string>;
  figures: Set<string>;
};

export type DevelopmentSnapshot = {
  id: string;
  anchors: Set<string>;
  titleAnchors: Set<string>;
  figures: Set<string>;
  day?: string;
};

export type StorylineSnapshot = {
  id: string;
  anchors: Set<string>;
  tickerCount: number;
  locked: boolean;
  developments: DevelopmentSnapshot[];
};

export type AttachEvidence = {
  sharedAnchors: number;
  containment: number;
  storylineContainment: number;
  path: "body" | "title";
};

export type AttachDecision =
  | { kind: "skip"; reason: "no-anchors" }
  | { kind: "openStoryline" }
  | { kind: "openDevelopment"; storylineId: string; evidence: AttachEvidence }
  | {
      kind: "cite";
      storylineId: string;
      developmentId: string;
      evidence: AttachEvidence;
    };

const roundTwo = (value: number): number => Math.round(value * 100) / 100;

/**
 * Whether two publish days are close enough for the headline path.
 *
 * An absent day on either side counts as close enough: candidates arrive from one rolling window, so
 * requiring a stamp most rows do not carry would only excuse them from the check.
 */
const withinAdjacentDay = (
  left: string | undefined,
  right: string | undefined,
): boolean => {
  if (left === undefined || right === undefined) {
    return true;
  }
  if (left === right) {
    return true;
  }
  const leftTime = Date.parse(`${left}T00:00:00Z`);
  const rightTime = Date.parse(`${right}T00:00:00Z`);
  if (Number.isNaN(leftTime) || Number.isNaN(rightTime)) {
    return false;
  }

  return Math.abs(leftTime - rightTime) <= 86_400_000;
};

/**
 * Reduces one candidate article to the anchors and figures every later comparison reads.
 *
 * @param candidate - The article being considered.
 */
export const anchorsFor = (candidate: Candidate): CandidateAnchors => {
  const title = candidate.title.slice(0, TITLE_CHAR_LIMIT);
  const comparisonText = `${title}\n${candidate.text.slice(0, COMPARISON_CHAR_LIMIT)}`;

  return {
    anchors: distinctiveAnchorTokens(tokenize(comparisonText)),
    titleAnchors: distinctiveAnchorTokens(tokenize(title)),
    figures: extractFigures(comparisonText),
  };
};

type Match = {
  storyline: StorylineSnapshot;
  development: DevelopmentSnapshot;
  sharedAnchors: number;
  containment: number;
  path: "body" | "title";
};

const bestBodyMatch = (
  candidate: CandidateAnchors,
  storylines: readonly StorylineSnapshot[],
): Match | undefined => {
  if (candidate.anchors.size === 0) {
    return undefined;
  }

  let best: Match | undefined;
  for (const storyline of storylines) {
    for (const development of storyline.developments) {
      if (development.anchors.size === 0) {
        continue;
      }
      const shared = sharedCount(candidate.anchors, development.anchors);
      if (shared < MIN_SHARED_ANCHORS) {
        continue;
      }
      const score = containment(candidate.anchors, development.anchors);
      if (score < MIN_CONTAINMENT) {
        continue;
      }
      if (best === undefined || shared > best.sharedAnchors) {
        best = {
          storyline,
          development,
          sharedAnchors: shared,
          containment: score,
          path: "body",
        };
      }
    }
  }

  return best;
};

const bestTitleMatch = (
  candidate: CandidateAnchors,
  publishedDay: string | undefined,
  storylines: readonly StorylineSnapshot[],
): Match | undefined => {
  if (candidate.titleAnchors.size === 0) {
    return undefined;
  }

  let best: Match | undefined;
  for (const storyline of storylines) {
    for (const development of storyline.developments) {
      if (development.titleAnchors.size === 0) {
        continue;
      }
      if (!withinAdjacentDay(development.day, publishedDay)) {
        continue;
      }
      const shared = sharedCount(
        candidate.titleAnchors,
        development.titleAnchors,
      );
      if (shared < TITLE_MIN_SHARED_ANCHORS) {
        continue;
      }
      const score = containment(
        candidate.titleAnchors,
        development.titleAnchors,
      );
      if (score < TITLE_MIN_CONTAINMENT) {
        continue;
      }
      if (best === undefined || shared > best.sharedAnchors) {
        best = {
          storyline,
          development,
          sharedAnchors: shared,
          containment: score,
          path: "title",
        };
      }
    }
  }

  return best;
};

/**
 * Decides what one candidate article does to the knowledge base.
 *
 * - Important: a locked Storyline is treated as absent. The candidate opens its own thread rather
 *   than joining one an operator has not yet ruled on, so a suspected bad merge cannot keep growing.
 *
 * @param candidate - Anchors and figures of the article being considered.
 * @param publishedDay - The article's `YYYY-MM-DD` day, when it carries one.
 * @param storylines - Candidate Storylines retrieved by shared anchor.
 * @returns Whether to open a Storyline, open a Development, cite an existing one, or skip.
 */
export const decideAttachment = (
  candidate: CandidateAnchors,
  publishedDay: string | undefined,
  storylines: readonly StorylineSnapshot[],
): AttachDecision => {
  if (candidate.anchors.size === 0) {
    return { kind: "skip", reason: "no-anchors" };
  }

  const open = storylines.filter((storyline) => !storyline.locked);
  const match =
    bestBodyMatch(candidate, open) ??
    bestTitleMatch(candidate, publishedDay, open);

  if (match === undefined) {
    return { kind: "openStoryline" };
  }

  const storylineContainment = containment(
    candidate.anchors,
    match.storyline.anchors,
  );
  if (storylineContainment < STORYLINE_MIN_CONTAINMENT) {
    return { kind: "openStoryline" };
  }

  const evidence: AttachEvidence = {
    sharedAnchors: match.sharedAnchors,
    containment: roundTwo(match.containment),
    storylineContainment: roundTwo(storylineContainment),
    path: match.path,
  };

  const bringsNewFigure = [...candidate.figures].some(
    (figure) => !match.development.figures.has(figure),
  );
  const sameMove =
    match.containment >= SAME_MOVE_CONTAINMENT && !bringsNewFigure;

  if (sameMove) {
    return {
      kind: "cite",
      storylineId: match.storyline.id,
      developmentId: match.development.id,
      evidence,
    };
  }

  return {
    kind: "openDevelopment",
    storylineId: match.storyline.id,
    evidence,
  };
};
