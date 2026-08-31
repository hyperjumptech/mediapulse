import { existsSync, readFileSync, writeFileSync } from "node:fs";

import cases from "../corpus/cases.json";
import { readScores, summarizeCells, violationTotals } from "./aggregate.js";
import { extractMaterialFigures } from "./material-figures.js";
import type { CaseScore } from "./assertions.js";
import type { EvalCase } from "./types.js";

const evalCases = cases as EvalCase[];

const sumMatches = (text: string, pattern: RegExp): number =>
  [...text.matchAll(pattern)].reduce(
    (total, match) => total + Number.parseInt(match[1] ?? "0", 10),
    0,
  );

const readAttrition = (logPaths: string[]) => {
  const text = logPaths
    .filter((path) => existsSync(path))
    .map((path) => readFileSync(path, "utf8"))
    .join("\n");

  const reasons: Record<string, number> = {};
  for (const match of text.matchAll(/"reason":"([a-z_]+)"/g)) {
    const reason = match[1] ?? "";
    reasons[reason] = (reasons[reason] ?? 0) + 1;
  }

  return {
    pointsUngrounded: sumMatches(
      text,
      /Dropped (\d+) point\(s\) citing a figure/g,
    ),
    pointsUnusable: sumMatches(text, /Dropped (\d+) unusable summary point/g),
    pointsRepeated: sumMatches(
      text,
      /Dropped (\d+) point\(s\) restating a figure/g,
    ),
    articlesTitleFigure: [
      ...text.matchAll(/its heading cites a figure absent/g),
    ].length,
    articlesNoRelation: [
      ...text.matchAll(/no summary point relates to its own heading/g),
    ].length,
    unusableReasons: reasons,
  };
};

const caseById = new Map(evalCases.map((entry) => [entry.case_id, entry]));

export const buildReportData = (
  stagePaths: { stage: string; path: string }[],
  logPaths: string[],
): unknown => {
  const stages = stagePaths.map(({ stage, path }) => {
    const scores = readScores(path);

    return {
      stage,
      cells: summarizeCells(scores),
      violations: violationTotals(scores),
      scores,
    };
  });

  const allScores = stages.flatMap((entry) => entry.scores);

  const drilldown = evalCases.map((evalCase) => {
    const articlesWithFigures = evalCase.pool
      .map((article) => ({
        article,
        material: extractMaterialFigures(
          article.title,
          article.content,
          evalCase.aliases,
        ),
      }))
      .filter((entry) => entry.material.length > 0);

    const perCell = allScores
      .filter(
        (score) => score.caseId === evalCase.case_id && score.repeat === 0,
      )
      .map((score: CaseScore) => ({
        model: score.model,
        promptVariant: score.promptVariant,
        status: score.status,
        carried: score.carried,
        figuresTotal: score.figures.length,
        figures: score.figures.map((figure) => ({
          raw: figure.figure.raw,
          articleTitle: figure.articleTitle,
          verdict: figure.verdict,
        })),
        violations: score.violations,
      }));

    return {
      caseId: evalCase.case_id,
      symbol: evalCase.symbol,
      stratum: evalCase.stratum,
      runAt: evalCase.run_at,
      poolSize: evalCase.pool.length,
      shippedSubject: evalCase.shipped_subject,
      shippedItems: (evalCase.shipped_items ?? []).map((item) => ({
        title: item.title,
        points: item.points,
      })),
      articles: articlesWithFigures.map(({ article, material }) => ({
        title: article.title,
        url: article.url,
        section: article.section,
        excerpt: `${article.content.slice(0, 320)}...`,
        materialFigures: material.map((figure) => ({
          raw: figure.raw,
          sentence: figure.sentence.slice(0, 220),
        })),
      })),
      perCell,
    };
  });

  const attrition = readAttrition(logPaths);
  const shippedPoints = allScores.reduce(
    (total, score) => total + score.shippedPoints,
    0,
  );
  const deletedPoints =
    attrition.pointsUngrounded +
    attrition.pointsUnusable +
    attrition.pointsRepeated;

  return {
    generatedAt: new Date().toISOString(),
    attrition: {
      ...attrition,
      shippedPoints,
      deletedPoints,
      deletionRate: deletedPoints / (deletedPoints + shippedPoints),
    },
    corpus: {
      cases: evalCases.length,
      poolArticles: evalCases.reduce(
        (sum, entry) => sum + entry.pool.length,
        0,
      ),
      articlesWithContent: evalCases.reduce(
        (sum, entry) =>
          sum +
          entry.pool.filter((article) => !article.contentIsDescriptionOnly)
            .length,
        0,
      ),
      strata: evalCases.reduce<Record<string, number>>((counts, entry) => {
        counts[entry.stratum] = (counts[entry.stratum] ?? 0) + 1;

        return counts;
      }, {}),
    },
    stages: stages.map(({ scores, ...rest }) => rest),
    drilldown,
  };
};

if (import.meta.main) {
  const scratch = process.env.EVAL_LOG_DIR ?? ".";
  const stages = [
    { stage: "stage1", path: "./results/stage1.jsonl" },
    ...(process.argv.includes("--stage2")
      ? [{ stage: "stage2", path: "./results/stage2.jsonl" }]
      : []),
  ];
  const data = buildReportData(
    stages,
    stages.map((entry) => `${scratch}/${entry.stage}.log`),
  );
  writeFileSync("./results/report-data.json", JSON.stringify(data, null, 2));
  console.log("wrote results/report-data.json");
}
