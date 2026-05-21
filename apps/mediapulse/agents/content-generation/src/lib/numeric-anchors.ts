import type { IndustryNewsletterStructure } from "../industry-newsletter-schema.js";
import type { SourceForGeneration } from "../types.js";

/** Unit classification for a matched numeric token. */
export type NumericAnchorUnit =
  | "currency"
  | "percent"
  | "count"
  | "ratio"
  | "other";

/** A concrete figure extracted from a source article body. */
export type NumericAnchor = {
  /** 1-based index into the numbered Article list in the user prompt. */
  articleIndex: number;
  /** Verbatim substring from the source body. */
  raw: string;
  /** Trimmed, whitespace-normalized form of {@link raw}. */
  normalized: string;
  unit: NumericAnchorUnit;
  /** Parsed numeric value (best-effort; may be `NaN`). */
  magnitude: number;
  /** Higher values are preferred when capping anchors (currency/percent = 1.0). */
  salience: number;
};

/** Anchor candidate with body offset for salience/position ranking. */
export type NumericAnchorCandidate = NumericAnchor & { position: number };

/** Rolled-up figure audit metrics for a single newsletter run. */
export type NumberAuditReport = {
  unmatchedFigures: string[];
  anchorsExtracted: number;
  anchorsTopSelected: number;
  anchorsQuotedVerbatim: number;
  anchorCoverageRatio: number;
};

/** Policy for briefing figures that do not appear in any source body. */
export type NumericAnchorUnmatchedPolicy = "warn" | "strip";

export type NumericAnchorSummary = NumberAuditReport;

const FIGURE_REMOVED_PLACEHOLDER = "[figure removed]";

const CURRENCY_PATTERN =
  /(?:Rp|IDR|USD|\$)\s?\d[\d,.\s]*(?:\s?(?:trillion|miliar|billion|juta|million|ribu|thousand|T|B|M))?/gi;

const PERCENT_PATTERN = /\d+(?:[.,]\d+)?\s?%/g;

const COUNT_PATTERN =
  /\d+(?:[.,]\d{3})*\s+(?:new\s+)?(?:branches|outlets|customers|users|stores)/gi;

const RATIO_PATTERN = /\d+(?:[.,]\d+)?\s?(?:x|kali)/gi;

const UNIT_SALIENCE: Record<NumericAnchorUnit, number> = {
  currency: 1,
  percent: 1,
  count: 0.7,
  ratio: 0.7,
  other: 0.5,
};

const PATTERN_BANK: ReadonlyArray<{
  unit: NumericAnchorUnit;
  pattern: RegExp;
}> = [
  { unit: "currency", pattern: CURRENCY_PATTERN },
  { unit: "percent", pattern: PERCENT_PATTERN },
  { unit: "count", pattern: COUNT_PATTERN },
  { unit: "ratio", pattern: RATIO_PATTERN },
];

/**
 * Normalizes whitespace in a matched figure string.
 *
 * @param raw - Verbatim regex match.
 */
export const normalizeNumericAnchorRaw = (raw: string): string =>
  raw.trim().replace(/\s+/g, " ");

/**
 * Best-effort parse of the leading numeric token in a figure string.
 *
 * @param raw - Verbatim or normalized figure text.
 */
export const parseMagnitudeFromFigure = (raw: string): number => {
  const match = raw.match(/[\d,.]+/);
  if (match === null) {
    return Number.NaN;
  }

  const normalized = match[0].replace(/,/g, "").replace(",", ".");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

/**
 * Returns all regex matches for a pattern over text (resets `lastIndex`).
 *
 * @param text - Source or briefing text.
 * @param pattern - Global regex from the anchor bank.
 */
const matchAllPattern = (text: string, pattern: RegExp): RegExpMatchArray[] => {
  const flags = pattern.flags.includes("g")
    ? pattern.flags
    : `${pattern.flags}g`;
  const globalPattern = new RegExp(pattern.source, flags);
  return [...text.matchAll(globalPattern)];
};

/**
 * Extracts numeric anchors from one article body.
 *
 * @param source - Article with `content` body text.
 * @param articleIndex - 1-based article number in the user prompt.
 */
export const extractNumericAnchorsFromSource = (
  source: Pick<SourceForGeneration, "content">,
  articleIndex: number,
): NumericAnchorCandidate[] => {
  const body = source.content;
  const seen = new Set<string>();
  const candidates: NumericAnchorCandidate[] = [];

  for (const { unit, pattern } of PATTERN_BANK) {
    for (const match of matchAllPattern(body, pattern)) {
      const raw = match[0];
      const normalized = normalizeNumericAnchorRaw(raw);
      const dedupeKey = `${String(articleIndex)}:${normalized.toLowerCase()}`;
      if (seen.has(dedupeKey)) {
        continue;
      }
      seen.add(dedupeKey);

      candidates.push({
        articleIndex,
        raw,
        normalized,
        unit,
        magnitude: parseMagnitudeFromFigure(raw),
        salience: UNIT_SALIENCE[unit],
        position: match.index ?? 0,
      });
    }
  }

  return candidates;
};

/**
 * Extracts anchor candidates from every source in prompt order (`Article 1` first).
 *
 * @param sources - Ordered prompt sources.
 */
export const extractNumericAnchorsFromSources = (
  sources: readonly SourceForGeneration[],
): NumericAnchorCandidate[] =>
  sources.flatMap((source, index) =>
    extractNumericAnchorsFromSource(source, index + 1),
  );

/**
 * Caps anchors per article and overall, preferring high-salience early mentions.
 *
 * @param anchors - Full extracted anchor list.
 * @param perArticleCap - Maximum anchors kept per `articleIndex`.
 * @param totalCap - Maximum anchors kept across all articles.
 */
export const selectTopAnchors = (
  anchors: readonly NumericAnchorCandidate[],
  perArticleCap: number = 5,
  totalCap: number = 25,
): NumericAnchor[] => {
  const byArticle = new Map<number, NumericAnchorCandidate[]>();
  for (const anchor of anchors) {
    const list = byArticle.get(anchor.articleIndex) ?? [];
    list.push(anchor);
    byArticle.set(anchor.articleIndex, list);
  }

  const perArticleSelected: NumericAnchorCandidate[] = [];
  for (const list of byArticle.values()) {
    const sorted = [...list].sort((left, right) => {
      if (right.salience !== left.salience) {
        return right.salience - left.salience;
      }
      return left.position - right.position;
    });
    perArticleSelected.push(...sorted.slice(0, perArticleCap));
  }

  const overallSorted = [...perArticleSelected].sort((left, right) => {
    if (right.salience !== left.salience) {
      return right.salience - left.salience;
    }
    return left.position - right.position;
  });

  return overallSorted
    .slice(0, totalCap)
    .map(({ position: _position, ...anchor }) => anchor);
};

/**
 * Renders the verbatim-figures sidecar block for the LLM user prompt.
 *
 * @param anchors - Top-selected anchors (may be empty).
 */
export const formatAnchorsForPrompt = (
  anchors: readonly NumericAnchor[],
): string => {
  if (anchors.length === 0) {
    return "";
  }

  const lines = anchors.map(
    (anchor) => `- ${anchor.raw} (Article ${String(anchor.articleIndex)})`,
  );

  return [
    "VERBATIM FIGURES AVAILABLE FROM SOURCES:",
    ...lines,
    "When quoting a figure in a bullet, use the EXACT string above. Do not paraphrase or round.",
  ].join("\n");
};

/**
 * Collects all prose and bullet strings from a newsletter structure.
 *
 * @param structure - Validated LLM newsletter JSON.
 */
export const collectBriefingTextSegments = (
  structure: IndustryNewsletterStructure,
): string[] => {
  const segments: string[] = [
    structure.industryPulse.prose,
    ...structure.competitiveLandscape.bullets.map((bullet) => bullet.text),
    ...structure.dealsAndMovements.bullets.map((bullet) => bullet.text),
    ...structure.regulatoryPolicyWatch.bullets.map((bullet) => bullet.text),
    ...structure.quickHits.items.map((item) => item.text),
  ];

  if (structure.disruptorsOrTech.format === "prose") {
    segments.push(structure.disruptorsOrTech.prose);
  } else {
    segments.push(
      ...structure.disruptorsOrTech.bullets.map((bullet) => bullet.text),
    );
  }

  if (structure.readWatchListen !== undefined) {
    segments.push(structure.readWatchListen.summary);
  }

  if (structure.quoteOfTheWeek !== undefined) {
    segments.push(
      structure.quoteOfTheWeek.quote,
      structure.quoteOfTheWeek.attribution,
    );
  }

  return segments;
};

/**
 * Extracts figure strings from briefing text using the anchor regex bank.
 *
 * @param text - Single briefing segment.
 */
export const extractFiguresFromBriefingText = (text: string): string[] => {
  const seen = new Set<string>();
  const figures: string[] = [];

  for (const { pattern } of PATTERN_BANK) {
    for (const match of matchAllPattern(text, pattern)) {
      const raw = match[0];
      const normalized = normalizeNumericAnchorRaw(raw);
      if (!seen.has(normalized)) {
        seen.add(normalized);
        figures.push(raw);
      }
    }
  }

  return figures;
};

/**
 * Returns combined source bodies (title + content) for substring checks.
 *
 * @param sources - Ordered prompt sources.
 */
const buildSourceCorpus = (sources: readonly SourceForGeneration[]): string[] =>
  sources.map((source) => `${source.title}\n${source.content}`);

/**
 * Returns true when `figure` appears verbatim in at least one source corpus entry.
 *
 * @param figure - Raw figure string from the briefing.
 * @param corpus - Per-source title+body strings.
 */
export const figureAppearsInSources = (
  figure: string,
  corpus: readonly string[],
): boolean => corpus.some((body) => body.includes(figure));

/**
 * Counts how many top anchors appear verbatim in the briefing text.
 *
 * @param briefingText - Joined briefing segments.
 * @param topAnchors - Caps applied anchors presented to the model.
 */
export const countAnchorsQuotedVerbatim = (
  briefingText: string,
  topAnchors: readonly NumericAnchor[],
): number =>
  topAnchors.filter((anchor) => briefingText.includes(anchor.raw)).length;

/**
 * Audits briefing figures against source bodies and computes anchor coverage.
 *
 * @param structure - Generated newsletter JSON.
 * @param sources - Ordered prompt sources used for generation.
 * @param topAnchors - Anchors selected for the prompt sidecar.
 * @param anchorsExtracted - Count before capping (for observability).
 */
export const auditNumbersInBriefing = (
  structure: IndustryNewsletterStructure,
  sources: readonly SourceForGeneration[],
  topAnchors: readonly NumericAnchor[],
  anchorsExtracted: number,
): NumberAuditReport => {
  const corpus = buildSourceCorpus(sources);
  const segments = collectBriefingTextSegments(structure);
  const briefingText = segments.join("\n");

  const figureSet = new Set<string>();
  for (const segment of segments) {
    for (const figure of extractFiguresFromBriefingText(segment)) {
      figureSet.add(figure);
    }
  }

  const unmatchedFigures = [...figureSet].filter(
    (figure) => !figureAppearsInSources(figure, corpus),
  );

  const anchorsTopSelected = topAnchors.length;
  const anchorsQuotedVerbatim = countAnchorsQuotedVerbatim(
    briefingText,
    topAnchors,
  );
  const anchorCoverageRatio =
    anchorsTopSelected === 0 ? 0 : anchorsQuotedVerbatim / anchorsTopSelected;

  return {
    unmatchedFigures,
    anchorsExtracted,
    anchorsTopSelected,
    anchorsQuotedVerbatim,
    anchorCoverageRatio,
  };
};

/**
 * Replaces unmatched figure substrings in one text segment.
 *
 * @param text - Bullet or prose line.
 * @param unmatchedFigures - Figures not found in any source.
 */
export const stripUnmatchedFiguresFromText = (
  text: string,
  unmatchedFigures: readonly string[],
): string => {
  const sorted = [...unmatchedFigures].sort(
    (left, right) => right.length - left.length,
  );
  let result = text;
  for (const figure of sorted) {
    if (figure.length === 0) {
      continue;
    }
    result = result.split(figure).join(FIGURE_REMOVED_PLACEHOLDER);
  }
  return result;
};

/**
 * Strips unmatched figures from every briefing text field in the structure.
 *
 * @param structure - Newsletter JSON to mutate.
 * @param unmatchedFigures - Figures that failed the source substring audit.
 */
export const stripUnmatchedFiguresFromStructure = (
  structure: IndustryNewsletterStructure,
  unmatchedFigures: readonly string[],
): IndustryNewsletterStructure => {
  if (unmatchedFigures.length === 0) {
    return structure;
  }

  const next = structuredClone(structure);
  const strip = (text: string) =>
    stripUnmatchedFiguresFromText(text, unmatchedFigures);

  next.industryPulse.prose = strip(next.industryPulse.prose);
  next.competitiveLandscape.bullets = next.competitiveLandscape.bullets.map(
    (bullet) => ({
      ...bullet,
      text: strip(bullet.text),
    }),
  );
  next.dealsAndMovements.bullets = next.dealsAndMovements.bullets.map(
    (bullet) => ({
      ...bullet,
      text: strip(bullet.text),
    }),
  );
  next.regulatoryPolicyWatch.bullets = next.regulatoryPolicyWatch.bullets.map(
    (bullet) => ({
      ...bullet,
      text: strip(bullet.text),
    }),
  );
  next.quickHits.items = next.quickHits.items.map((item) => ({
    ...item,
    text: strip(item.text),
  }));

  if (next.disruptorsOrTech.format === "prose") {
    next.disruptorsOrTech.prose = strip(next.disruptorsOrTech.prose);
  } else {
    next.disruptorsOrTech.bullets = next.disruptorsOrTech.bullets.map(
      (bullet) => ({
        ...bullet,
        text: strip(bullet.text),
      }),
    );
  }

  if (next.readWatchListen !== undefined) {
    next.readWatchListen = {
      ...next.readWatchListen,
      summary: strip(next.readWatchListen.summary),
    };
  }

  if (next.quoteOfTheWeek !== undefined) {
    next.quoteOfTheWeek = {
      ...next.quoteOfTheWeek,
      quote: strip(next.quoteOfTheWeek.quote),
      attribution: strip(next.quoteOfTheWeek.attribution),
    };
  }

  return next;
};

export type ApplyNumericAnchorPolicyResult = {
  structure: IndustryNewsletterStructure;
  report: NumberAuditReport;
  /** Figures removed when `policy` is `strip`. */
  strippedFigures: string[];
};

/**
 * Audits briefing figures and optionally strips figures missing from sources.
 *
 * @param structure - Generated newsletter JSON.
 * @param sources - Ordered prompt sources.
 * @param topAnchors - Anchors shown in the prompt sidecar.
 * @param anchorsExtracted - Pre-cap extraction count.
 * @param policy - `warn` leaves text unchanged; `strip` replaces unmatched tokens.
 */
export const applyNumericAnchorPolicy = (
  structure: IndustryNewsletterStructure,
  sources: readonly SourceForGeneration[],
  topAnchors: readonly NumericAnchor[],
  anchorsExtracted: number,
  policy: NumericAnchorUnmatchedPolicy,
): ApplyNumericAnchorPolicyResult => {
  const report = auditNumbersInBriefing(
    structure,
    sources,
    topAnchors,
    anchorsExtracted,
  );

  if (policy === "strip" && report.unmatchedFigures.length > 0) {
    return {
      structure: stripUnmatchedFiguresFromStructure(
        structure,
        report.unmatchedFigures,
      ),
      report,
      strippedFigures: report.unmatchedFigures,
    };
  }

  return {
    structure,
    report,
    strippedFigures: [],
  };
};
