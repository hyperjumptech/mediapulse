import { tokenize } from "./phrase-link-injector.js";
import { distinctiveAnchorTokens } from "./text-similarity.js";

/** Scale words that change what a bare number means, normalized to a single letter. */
const SCALE_SUFFIX: Readonly<Record<string, string>> = {
  thousand: "k",
  ribu: "k",
  million: "m",
  juta: "m",
  billion: "b",
  miliar: "b",
  milyar: "b",
  trillion: "t",
  triliun: "t",
};

const SCALE_PATTERN = Object.keys(SCALE_SUFFIX).join("|");

const FIGURE_PATTERN = new RegExp(
  String.raw`(\d[\d.,]*)\s*(%|percent|persen|${SCALE_PATTERN})?`,
  "giu",
);

/**
 * Minimum distinctive anchors two points must share, on top of a shared figure, before the later
 * one is treated as a repeat.
 *
 * A figure alone is not enough: two unrelated facts in one issue can both move 32%. Requiring the
 * surrounding words to match as well is what separates "ferronickel sales rose 32%" told twice from
 * two different things that happen to share a number.
 */
export const REPEATED_CLAIM_MIN_SHARED_ANCHORS = 2;

/**
 * Extracts comparable figure keys from a point.
 *
 * Numbers are normalized so `Rp75,9 triliun`, `Rp 75.9 trillion`, and `75.9T` collapse to one key.
 * Bare numbers below two digits are ignored, since a stray "3" carries no identity.
 *
 * @param point - One summary point.
 * @returns Normalized figure keys found in the point.
 */
export const figureKeys = (point: string): Set<string> => {
  const keys = new Set<string>();
  for (const match of point.matchAll(FIGURE_PATTERN)) {
    const rawNumber = match[1];
    if (rawNumber === undefined) {
      continue;
    }
    const digits = rawNumber.replaceAll(/[.,](?=\d{3}\b)/gu, "");
    const normalized = digits.replace(",", ".").replace(/\.0+$/u, "");
    if (normalized.replaceAll(/\D/gu, "").length < 2) {
      continue;
    }
    const unitWord = match[2]?.toLowerCase();
    const unit =
      unitWord === undefined
        ? ""
        : (SCALE_SUFFIX[unitWord] ??
          (unitWord.startsWith("%") ||
          unitWord === "percent" ||
          unitWord === "persen"
            ? "%"
            : ""));
    keys.add(`${normalized}${unit}`);
  }

  return keys;
};

const sharedCount = (left: Set<string>, right: Set<string>): number => {
  let shared = 0;
  for (const value of left) {
    if (right.has(value)) {
      shared += 1;
    }
  }

  return shared;
};

type Seen = { figures: Set<string>; anchors: Set<string> };

export type RepeatedClaimResult = {
  points: string[];
  dropped: string[];
};

/**
 * Removes points that restate a figure an earlier point in the same issue already carried.
 *
 * TLKM's 2026-08-05 issue stated Rp75.9 trillion of half-year revenue in three separate items across
 * two sections; GOTO stated Grab's $168 million EBITDA and its $750 million buyback twice each. The
 * articles were genuinely different, so source-level dedup had nothing to match on, but the reader
 * met the same number repeatedly.
 *
 * Points are visited in the order given, so callers should pass them in the order the reader meets
 * them and the first telling survives.
 *
 * @param points - Every point shipping in the issue, in reading order.
 * @param minSharedAnchors - Anchors that must match alongside the figure.
 * @returns The points to keep and the ones dropped as repeats.
 */
export const dropRepeatedClaims = (
  points: readonly string[],
  minSharedAnchors: number = REPEATED_CLAIM_MIN_SHARED_ANCHORS,
): RepeatedClaimResult => {
  const seen: Seen[] = [];
  const kept: string[] = [];
  const dropped: string[] = [];

  for (const point of points) {
    const figures = figureKeys(point);
    const anchors = distinctiveAnchorTokens(tokenize(point));
    const isRepeat =
      figures.size > 0 &&
      seen.some(
        (entry) =>
          sharedCount(figures, entry.figures) > 0 &&
          sharedCount(anchors, entry.anchors) >= minSharedAnchors,
      );

    if (isRepeat) {
      dropped.push(point);
      continue;
    }
    seen.push({ figures, anchors });
    kept.push(point);
  }

  return { points: kept, dropped };
};
