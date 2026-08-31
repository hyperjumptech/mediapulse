import {
  extractMaterialFigures,
  figuresInText,
  normalizeDigits,
  type MaterialFigure,
} from "./material-figures.js";
import { MAX_POINT_LENGTH } from "@workspace/email-templates/newsletter-document";

import type { EvalCase, PoolArticle } from "./types.js";
import type { ReplayOutcome } from "./replay.js";

export const ARITHMETIC_TOLERANCE = 0.02;

export type FigureVerdict =
  | "carried"
  | "not_selected"
  | "not_written"
  | "guard_dropped";

export type FigureOutcome = {
  articleUrl: string;
  articleTitle: string;
  figure: MaterialFigure;
  verdict: FigureVerdict;
};

export type FidelityCode =
  | "F1_ungrounded"
  | "F2_conversion_unsourced"
  | "F3_arithmetic_wrong"
  | "F4_truncated"
  | "F5_non_latin"
  | "F6_vacuous"
  | "F7_over_length";

export type FidelityViolation = {
  code: FidelityCode;
  point: string;
  detail: string;
};

export type CaseScore = {
  caseId: string;
  symbol: string;
  stratum: string;
  model: string;
  promptVariant: string;
  repeat: number;
  status: ReplayOutcome["status"];
  figures: FigureOutcome[];
  violations: FidelityViolation[];
  shippedPoints: number;
  shippedArticles: number;
  materialFiguresInPool: number;
  materialFiguresInSelected: number;
  carried: number;
};

const NON_LATIN = /[Ѐ-ӿ؀-ۿ一-鿿぀-ヿ가-힯]/;

const TRAILING_STOPWORD =
  /\b(and|with|by|the|of|to|for|in|on|a|an|dan|dengan)$/i;

const DECISION_TERMS = [
  "approved",
  "signed",
  "launched",
  "acquired",
  "appointed",
  "resigned",
  "suspended",
  "cancelled",
  "canceled",
  "issued",
  "raised",
  "cut",
  "banned",
  "ruled",
  "fined",
  "agreed",
  "plans",
  "will",
];

type ShippedArticle = { url: string; title: string; points: string[] };

const shippedArticlesOf = (outcome: ReplayOutcome): ShippedArticle[] => {
  const document = outcome.document as
    | { sections?: { articles?: ShippedArticle[] }[] }
    | undefined;

  return (document?.sections ?? []).flatMap(
    (section) => section.articles ?? [],
  );
};

const conversionPattern =
  /\(?\s*(?:usd|us\$|\$)\s*([\d.,]+)\s*(?:mn|bn|million|billion|juta|miliar)?\s*(?:at|@)\s*([\d.,]+)\s*(?:idr)?\s*\/?\s*usd\s*,?\s*([^)]*)\)?/i;

const parseAmount = (raw: string): number =>
  Number.parseFloat(raw.replace(/,/g, ""));

const conversionIsSound = (
  point: string,
  sourceDigits: Set<string>,
): boolean => {
  const match = conversionPattern.exec(point);
  if (match === null) {
    return false;
  }
  const converted = parseAmount(match[1] ?? "");
  const rate = parseAmount(match[2] ?? "");
  if (!Number.isFinite(converted) || !Number.isFinite(rate) || rate <= 0) {
    return false;
  }
  for (const digits of sourceDigits) {
    const base = Number.parseFloat(digits);
    if (!Number.isFinite(base)) {
      continue;
    }
    for (const scale of [1, 1e3, 1e6, 1e9, 1e12]) {
      for (const outScale of [1, 1e3, 1e6, 1e9]) {
        const expected = (base * scale) / rate / outScale;
        if (
          expected > 0 &&
          Math.abs(expected - converted) / expected <= ARITHMETIC_TOLERANCE
        ) {
          return true;
        }
      }
    }
  }

  return false;
};

const isDerivableRatio = (
  value: number,
  sourceDigits: Set<string>,
): boolean => {
  const numbers = [...sourceDigits]
    .map((digits) => Number.parseFloat(digits))
    .filter((parsed) => Number.isFinite(parsed) && parsed > 0);
  for (const numerator of numbers) {
    for (const denominator of numbers) {
      if (numerator === denominator) {
        continue;
      }
      const ratio = (numerator / denominator) * 100;
      if (
        ratio > 0 &&
        Math.abs(ratio - value) / value <= ARITHMETIC_TOLERANCE
      ) {
        return true;
      }
    }
  }

  return false;
};

const percentValuesIn = (point: string): number[] =>
  [...point.matchAll(/([\d.,]+)\s*(?:%|persen|percent)/gi)]
    .map((match) => Number.parseFloat((match[1] ?? "").replace(/,/g, ".")))
    .filter((parsed) => Number.isFinite(parsed));

const checkFidelity = (
  point: string,
  sourceText: string,
  allowsDerivation: boolean,
): FidelityViolation[] => {
  const violations: FidelityViolation[] = [];
  const trimmed = point.trim();

  if (trimmed.length > MAX_POINT_LENGTH) {
    violations.push({
      code: "F7_over_length",
      point,
      detail: `${String(trimmed.length)} chars`,
    });
  }
  if (NON_LATIN.test(trimmed)) {
    violations.push({
      code: "F5_non_latin",
      point,
      detail: "non-Latin script",
    });
  }
  if (TRAILING_STOPWORD.test(trimmed.replace(/[.]$/, ""))) {
    violations.push({
      code: "F4_truncated",
      point,
      detail: "ends on a stopword",
    });
  }

  const sourceDigits = figuresInText(sourceText);
  const pointDigits = figuresInText(trimmed);
  const hasName = /\b[A-Z][A-Za-z]{2,}/.test(trimmed);
  const hasDecision = DECISION_TERMS.some((term) =>
    trimmed.toLowerCase().includes(term),
  );
  if (pointDigits.size === 0 && !hasName && !hasDecision) {
    violations.push({
      code: "F6_vacuous",
      point,
      detail: "no number, name, or decision",
    });
  }

  const mentionsConversion = /\b(usd|us\$|\$)\s*[\d]/i.test(trimmed);
  if (mentionsConversion) {
    const namesRate = /\/\s*usd|idr per usd|per usd/i.test(trimmed);
    const namesDate = /\b(19|20)\d{2}\b/.test(trimmed);
    if (!namesRate || !namesDate) {
      violations.push({
        code: "F2_conversion_unsourced",
        point,
        detail: "converted amount without rate and date",
      });
    } else if (!conversionIsSound(trimmed, sourceDigits)) {
      violations.push({
        code: "F3_arithmetic_wrong",
        point,
        detail: "conversion does not reproduce from the stated rate",
      });
    }
  }

  for (const digits of pointDigits) {
    if (sourceDigits.has(digits)) {
      continue;
    }
    if (mentionsConversion) {
      continue;
    }
    const asPercent = percentValuesIn(trimmed).find(
      (value) => normalizeDigits(String(value)) === digits,
    );
    if (
      allowsDerivation &&
      asPercent !== undefined &&
      isDerivableRatio(asPercent, sourceDigits)
    ) {
      continue;
    }
    violations.push({
      code: "F1_ungrounded",
      point,
      detail: `figure ${digits} is not in the article`,
    });
  }

  return violations;
};

export const scoreCase = (
  evalCase: EvalCase,
  outcome: ReplayOutcome,
  allowsDerivation: boolean,
): CaseScore => {
  const shipped = shippedArticlesOf(outcome);
  const shippedByUrl = new Map(
    shipped.map((article) => [article.url, article]),
  );
  const rawByTitle = new Map(
    outcome.summarizerCalls.map((call) => [call.articleTitle, call.rawSummary]),
  );

  const figures: FigureOutcome[] = [];
  let materialFiguresInSelected = 0;

  for (const article of evalCase.pool as PoolArticle[]) {
    const material = extractMaterialFigures(
      article.title,
      article.content,
      evalCase.aliases,
    );
    if (material.length === 0) {
      continue;
    }
    const shippedArticle = shippedByUrl.get(article.url);
    const raw = rawByTitle.get(article.title);

    for (const figure of material) {
      let verdict: FigureVerdict;
      if (shippedArticle === undefined) {
        verdict = "not_selected";
      } else {
        materialFiguresInSelected += 1;
        const inShipped = figuresInText(shippedArticle.points.join(" ")).has(
          figure.digits,
        );
        if (inShipped) {
          verdict = "carried";
        } else {
          const inRaw =
            raw !== undefined &&
            figuresInText(raw.points.join(" ")).has(figure.digits);
          verdict = inRaw ? "guard_dropped" : "not_written";
        }
      }
      figures.push({
        articleUrl: article.url,
        articleTitle: article.title,
        figure,
        verdict,
      });
    }
  }

  const violations: FidelityViolation[] = [];
  for (const article of shipped) {
    const poolArticle = evalCase.pool.find(
      (candidate) => candidate.url === article.url,
    );
    const sourceText = poolArticle?.content ?? "";
    for (const point of article.points ?? []) {
      violations.push(...checkFidelity(point, sourceText, allowsDerivation));
    }
  }

  return {
    caseId: evalCase.case_id,
    symbol: evalCase.symbol,
    stratum: evalCase.stratum,
    model: outcome.model,
    promptVariant: outcome.promptVariant,
    repeat: outcome.repeat,
    status: outcome.status,
    figures,
    violations,
    shippedPoints: shipped.reduce(
      (total, article) => total + (article.points?.length ?? 0),
      0,
    ),
    shippedArticles: shipped.length,
    materialFiguresInPool: figures.length,
    materialFiguresInSelected,
    carried: figures.filter((entry) => entry.verdict === "carried").length,
  };
};
