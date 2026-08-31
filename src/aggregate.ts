import { readFileSync } from "node:fs";

import type { CaseScore, FidelityCode, FigureVerdict } from "./assertions.js";

export type CellSummary = {
  model: string;
  promptVariant: string;
  runs: number;
  failedRuns: number;
  figuresTotal: number;
  carried: number;
  coverage: number;
  selectedCoverage: number;
  verdicts: Record<FigureVerdict, number>;
  violations: Record<string, number>;
  violationsPerPoint: number;
  shippedPoints: number;
  coverageByRepeat: number[];
  coverageSpread: number;
};

const emptyVerdicts = (): Record<FigureVerdict, number> => ({
  carried: 0,
  not_selected: 0,
  not_written: 0,
  guard_dropped: 0,
});

export const readScores = (path: string): CaseScore[] =>
  readFileSync(path, "utf8")
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as CaseScore);

const coverageOf = (scores: CaseScore[]): number => {
  const total = scores.reduce((sum, score) => sum + score.figures.length, 0);
  const carried = scores.reduce((sum, score) => sum + score.carried, 0);

  return total === 0 ? 0 : carried / total;
};

export const summarizeCells = (scores: CaseScore[]): CellSummary[] => {
  const byCell = new Map<string, CaseScore[]>();
  for (const score of scores) {
    const key = `${score.model}|${score.promptVariant}`;
    byCell.set(key, [...(byCell.get(key) ?? []), score]);
  }

  const summaries: CellSummary[] = [];
  for (const [key, cellScores] of byCell) {
    const [model = "", promptVariant = ""] = key.split("|");
    const verdicts = emptyVerdicts();
    const violations: Record<string, number> = {};
    let shippedPoints = 0;

    for (const score of cellScores) {
      shippedPoints += score.shippedPoints;
      for (const figure of score.figures) {
        verdicts[figure.verdict] += 1;
      }
      for (const violation of score.violations) {
        violations[violation.code] = (violations[violation.code] ?? 0) + 1;
      }
    }

    const repeats = [
      ...new Set(cellScores.map((score) => score.repeat)),
    ].sort();
    const coverageByRepeat = repeats.map((repeat) =>
      coverageOf(cellScores.filter((score) => score.repeat === repeat)),
    );
    const violationCount = Object.values(violations).reduce(
      (sum, count) => sum + count,
      0,
    );

    summaries.push({
      model,
      promptVariant,
      runs: cellScores.length,
      failedRuns: cellScores.filter((score) => score.status === "failed")
        .length,
      figuresTotal: cellScores.reduce(
        (sum, score) => sum + score.figures.length,
        0,
      ),
      carried: cellScores.reduce((sum, score) => sum + score.carried, 0),
      coverage: coverageOf(cellScores),
      selectedCoverage:
        verdicts.carried + verdicts.not_written + verdicts.guard_dropped === 0
          ? 0
          : verdicts.carried /
            (verdicts.carried + verdicts.not_written + verdicts.guard_dropped),
      verdicts,
      violations,
      violationsPerPoint:
        shippedPoints === 0 ? 0 : violationCount / shippedPoints,
      shippedPoints,
      coverageByRepeat,
      coverageSpread:
        coverageByRepeat.length < 2
          ? 0
          : Math.max(...coverageByRepeat) - Math.min(...coverageByRepeat),
    });
  }

  return summaries.sort((left, right) => right.coverage - left.coverage);
};

export type CodeCount = { code: FidelityCode | string; count: number };

export const violationTotals = (scores: CaseScore[]): CodeCount[] => {
  const counts = new Map<string, number>();
  for (const score of scores) {
    for (const violation of score.violations) {
      counts.set(violation.code, (counts.get(violation.code) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([code, count]) => ({ code, count }))
    .sort((left, right) => right.count - left.count);
};
