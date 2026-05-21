const BOILERPLATE_FRAGMENTS = [
  "share this",
  "read more",
  "follow us on",
  "terms of service",
  "privacy policy",
  "cookie policy",
  "all rights reserved",
  "sign up for our newsletter",
] as const;

const DEFAULT_FINANCIAL_KEYWORDS = [
  "earnings",
  "revenue",
  "eps",
  "guidance",
  "ceo",
  "product",
  "announce",
] as const;

const NAV_SEPARATOR_PATTERN = /[|·•›>]/g;
const NAV_SEPARATOR_RATIO_THRESHOLD = 0.08;
const HEADLINE_MAX_LENGTH = 200;
const MIN_PARAGRAPH_LENGTH = 25;
const PARAGRAPH_JOIN = "\n\n";

export type TruncationTickerContext = {
  tickerSymbols: readonly string[];
  companyAliases: readonly string[];
};

export type TruncateArticleForExtractionOptions = {
  maxChars: number;
  tickerSymbols?: readonly string[];
  companyAliases?: readonly string[];
  leadParagraphsAlwaysKept?: number;
  financialKeywordsExtra?: readonly string[];
};

export type TruncateArticleForExtractionMeta = {
  kept: number;
  dropped: number;
  leadCharsKept: number;
  tickerSentencesKept: number;
  paragraphsKept: number;
  paragraphsDropped: number;
};

export type TruncateArticleForExtractionResult = {
  content: string;
  meta: TruncateArticleForExtractionMeta;
};

type ScoredParagraph = {
  text: string;
  index: number;
  score: number;
};

/**
 * Escapes user-provided text for safe use inside a RegExp.
 *
 * @param value - Raw string.
 */
const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Returns whether `needle` appears in `haystack` with word-boundary safety.
 *
 * @param haystack - Text to search.
 * @param needle - Token or phrase to find.
 */
const matchesWordBoundary = (haystack: string, needle: string): boolean => {
  const normalized = needle.trim();
  if (normalized.length === 0) {
    return false;
  }

  const pattern = new RegExp(
    `(?<![a-z0-9.])${escapeRegExp(normalized)}(?![a-z0-9])`,
    "i",
  );
  return pattern.test(haystack);
};

/**
 * Collapses 3+ newlines to 2, splits on double newlines, trims, and drops empties.
 * Falls back to sentence boundaries when no paragraph breaks exist.
 *
 * @param text - Raw article body.
 */
export const splitParagraphs = (text: string): string[] => {
  const normalized = text.replace(/\n{3,}/g, "\n\n").trim();
  if (normalized.length === 0) {
    return [];
  }

  if (/\n{2,}/.test(normalized)) {
    return normalized
      .split(/\n{2,}/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean);
  }

  return normalized
    .split(/(?<=[.!?])\s+(?=[A-Z])/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
};

/**
 * Returns whether a paragraph looks like nav crumbs or footer chrome.
 *
 * @param paragraph - Candidate paragraph.
 */
const isBoilerplateParagraph = (paragraph: string): boolean => {
  const trimmed = paragraph.trim();
  if (trimmed.length < MIN_PARAGRAPH_LENGTH) {
    return true;
  }

  const lower = trimmed.toLowerCase();
  if (BOILERPLATE_FRAGMENTS.some((fragment) => lower.includes(fragment))) {
    return true;
  }

  const separatorMatches = trimmed.match(NAV_SEPARATOR_PATTERN)?.length ?? 0;
  const separatorRatio =
    trimmed.length === 0 ? 0 : separatorMatches / trimmed.length;

  return separatorRatio > NAV_SEPARATOR_RATIO_THRESHOLD;
};

/**
 * Removes short fragments, nav crumbs, and canonical footer chrome paragraphs.
 *
 * @param paragraphs - Paragraphs in source order.
 */
export const dropBoilerplateParagraphs = (
  paragraphs: readonly string[],
): string[] =>
  paragraphs.filter((paragraph) => !isBoilerplateParagraph(paragraph));

/**
 * Scores a paragraph for ticker, company-alias, and financial-keyword overlap.
 *
 * @param paragraph - Paragraph text.
 * @param tickerSymbols - Exchange symbols to match with word boundaries.
 * @param companyAliases - Company names and aliases to match.
 * @param financialKeywords - Extra financial tokens beyond the built-in list.
 */
export const scoreParagraphForTicker = (
  paragraph: string,
  tickerSymbols: readonly string[],
  companyAliases: readonly string[],
  financialKeywords: readonly string[] = [],
): number => {
  let score = 0;

  if (tickerSymbols.some((symbol) => matchesWordBoundary(paragraph, symbol))) {
    score += 3;
  }

  if (companyAliases.some((alias) => matchesWordBoundary(paragraph, alias))) {
    score += 2;
  }

  const keywords = [
    ...DEFAULT_FINANCIAL_KEYWORDS,
    ...financialKeywords.map((keyword) => keyword.trim().toLowerCase()),
  ].filter(Boolean);

  if (keywords.some((keyword) => matchesWordBoundary(paragraph, keyword))) {
    score += 1;
  }

  return score;
};

/**
 * Extracts an optional headline from the first non-empty line when it is short enough.
 *
 * @param text - Raw article body.
 */
const extractHeadline = (
  text: string,
): { headline: string | null; body: string } => {
  const normalized = text.replace(/\n{3,}/g, "\n\n").trim();
  const firstBreak = normalized.search(/\n{2,}/);

  if (firstBreak === -1) {
    const firstLine = normalized.split("\n")[0]?.trim() ?? "";
    if (
      firstLine.length > 0 &&
      firstLine.length <= HEADLINE_MAX_LENGTH &&
      normalized.includes("\n")
    ) {
      return {
        headline: firstLine,
        body: normalized.slice(firstLine.length).trim(),
      };
    }
    return { headline: null, body: normalized };
  }

  const headline = normalized.slice(0, firstBreak).trim();
  const body = normalized.slice(firstBreak).trim();

  if (headline.length > 0 && headline.length <= HEADLINE_MAX_LENGTH) {
    return { headline, body };
  }

  return { headline: null, body: normalized };
};

/**
 * Allocates the character budget across headline, lead paragraphs, and score-ranked body.
 *
 * @param headline - Optional headline kept first.
 * @param paragraphs - Boilerplate-filtered paragraphs in source order.
 * @param scores - Parallel paragraph scores.
 * @param maxChars - Maximum output length.
 * @param leadParagraphsAlwaysKept - Count of opening paragraphs to always retain.
 */
export const allocateBudget = (
  headline: string | null,
  paragraphs: readonly string[],
  scores: readonly number[],
  maxChars: number,
  leadParagraphsAlwaysKept: number,
): {
  content: string;
  leadCharsKept: number;
  tickerSentencesKept: number;
  paragraphsKept: number;
  paragraphsDropped: number;
} => {
  const selected: string[] = [];
  const selectedIndexes = new Set<number>();
  let usedChars = 0;

  const tryAdd = (text: string): boolean => {
    const addition =
      selected.length === 0 ? text.length : PARAGRAPH_JOIN.length + text.length;
    if (usedChars + addition > maxChars) {
      return false;
    }
    selected.push(text);
    usedChars += addition;
    return true;
  };

  if (headline !== null) {
    tryAdd(headline);
  }

  let leadCharsKept = 0;
  const leadCount = Math.min(leadParagraphsAlwaysKept, paragraphs.length);
  for (let index = 0; index < leadCount; index += 1) {
    const paragraph = paragraphs[index];
    if (paragraph === undefined || selectedIndexes.has(index)) {
      continue;
    }
    if (tryAdd(paragraph)) {
      selectedIndexes.add(index);
      leadCharsKept += paragraph.length;
    }
  }

  const remaining = paragraphs
    .map((text, index) => ({
      text,
      index,
      score: scores[index] ?? 0,
    }))
    .filter((entry) => !selectedIndexes.has(entry.index))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return left.index - right.index;
    });

  for (const entry of remaining) {
    if (tryAdd(entry.text)) {
      selectedIndexes.add(entry.index);
    }
  }

  const tickerSentencesKept = [...selectedIndexes].filter(
    (index) => (scores[index] ?? 0) >= 3,
  ).length;

  return {
    content: selected.join(PARAGRAPH_JOIN),
    leadCharsKept,
    tickerSentencesKept,
    paragraphsKept: selectedIndexes.size,
    paragraphsDropped: paragraphs.length - selectedIndexes.size,
  };
};

/**
 * Builds ticker symbols and company aliases from analysis GET vocabulary.
 *
 * @param entityTypes - Entity types from analysis GET.
 * @param existingEntities - Existing KG entities scoped to the ticker.
 */
export const resolveTruncationTickerContext = (
  entityTypes: readonly { id: string; name: string }[],
  existingEntities: readonly {
    canonicalName: string;
    typeId: string;
    aliases: readonly string[];
  }[],
): TruncationTickerContext => {
  const companyType = entityTypes.find(
    (entityType) => entityType.name.toLowerCase() === "company",
  );
  const companyEntities = companyType
    ? existingEntities.filter((entity) => entity.typeId === companyType.id)
    : existingEntities;

  const tickerSymbols: string[] = [];
  const companyAliases: string[] = [];
  const seenSymbols = new Set<string>();
  const seenAliases = new Set<string>();

  for (const entity of companyEntities) {
    const canonical = entity.canonicalName.trim();
    const symbolKey = canonical.toLowerCase();
    if (canonical.length > 0 && !seenSymbols.has(symbolKey)) {
      seenSymbols.add(symbolKey);
      tickerSymbols.push(canonical);
    }

    for (const alias of [entity.canonicalName, ...entity.aliases]) {
      const trimmed = alias.trim();
      const aliasKey = trimmed.toLowerCase();
      if (trimmed.length > 0 && !seenAliases.has(aliasKey)) {
        seenAliases.add(aliasKey);
        companyAliases.push(trimmed);
      }
    }
  }

  return { tickerSymbols, companyAliases };
};

/**
 * Truncates article content for LLM extraction using structure-aware paragraph selection.
 *
 * @param rawContent - Full article body from the data source.
 * @param options - Character budget, ticker context, and tuning knobs.
 */
export const truncateArticleForExtraction = (
  rawContent: string,
  options: TruncateArticleForExtractionOptions,
): TruncateArticleForExtractionResult => {
  const leadParagraphsAlwaysKept = options.leadParagraphsAlwaysKept ?? 2;
  const tickerSymbols = options.tickerSymbols ?? [];
  const companyAliases = options.companyAliases ?? [];
  const financialKeywordsExtra = options.financialKeywordsExtra ?? [];

  const { headline, body } = extractHeadline(rawContent);
  const paragraphs = splitParagraphs(body);
  const cleanedParagraphs = dropBoilerplateParagraphs(paragraphs);
  const cleanedContent =
    headline === null
      ? cleanedParagraphs.join(PARAGRAPH_JOIN)
      : [headline, ...cleanedParagraphs].join(PARAGRAPH_JOIN);

  if (options.maxChars >= cleanedContent.length) {
    return {
      content: cleanedContent,
      meta: {
        kept: cleanedContent.length,
        dropped: Math.max(0, rawContent.length - cleanedContent.length),
        leadCharsKept: cleanedParagraphs
          .slice(0, leadParagraphsAlwaysKept)
          .reduce((sum, paragraph) => sum + paragraph.length, 0),
        tickerSentencesKept: cleanedParagraphs.filter(
          (paragraph) =>
            scoreParagraphForTicker(
              paragraph,
              tickerSymbols,
              companyAliases,
              financialKeywordsExtra,
            ) >= 3,
        ).length,
        paragraphsKept: cleanedParagraphs.length,
        paragraphsDropped: paragraphs.length - cleanedParagraphs.length,
      },
    };
  }

  const scores = cleanedParagraphs.map((paragraph) =>
    scoreParagraphForTicker(
      paragraph,
      tickerSymbols,
      companyAliases,
      financialKeywordsExtra,
    ),
  );

  const allocated = allocateBudget(
    headline,
    cleanedParagraphs,
    scores,
    options.maxChars,
    leadParagraphsAlwaysKept,
  );

  return {
    content: allocated.content,
    meta: {
      kept: allocated.content.length,
      dropped: Math.max(0, rawContent.length - allocated.content.length),
      leadCharsKept: allocated.leadCharsKept,
      tickerSentencesKept: allocated.tickerSentencesKept,
      paragraphsKept: allocated.paragraphsKept,
      paragraphsDropped:
        allocated.paragraphsDropped +
        (paragraphs.length - cleanedParagraphs.length),
    },
  };
};

/**
 * Returns zeroed truncation totals for run-level observability aggregation.
 */
export const createEmptyTruncationTotals =
  (): TruncateArticleForExtractionMeta => ({
    kept: 0,
    dropped: 0,
    leadCharsKept: 0,
    tickerSentencesKept: 0,
    paragraphsKept: 0,
    paragraphsDropped: 0,
  });

/**
 * Adds one source-level truncation meta into running batch totals.
 *
 * @param totals - Mutable aggregate updated in place.
 * @param meta - Per-source truncation meta.
 */
export const accumulateTruncationMeta = (
  totals: TruncateArticleForExtractionMeta,
  meta: TruncateArticleForExtractionMeta,
): void => {
  totals.kept += meta.kept;
  totals.dropped += meta.dropped;
  totals.leadCharsKept += meta.leadCharsKept;
  totals.tickerSentencesKept += meta.tickerSentencesKept;
  totals.paragraphsKept += meta.paragraphsKept;
  totals.paragraphsDropped += meta.paragraphsDropped;
};
