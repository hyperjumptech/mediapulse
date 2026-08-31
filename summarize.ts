import {
  readScores,
  summarizeCells,
  violationTotals,
} from "./src/aggregate.js";

const scores = readScores(process.argv[2] ?? "./results/stage1.jsonl");
console.log(`scores: ${scores.length}`);
for (const cell of summarizeCells(scores)) {
  console.log(
    `${cell.model.padEnd(30)} ${cell.promptVariant} n=${String(cell.runs).padStart(3)} ` +
      `cov=${(cell.coverage * 100).toFixed(1)}% selCov=${(cell.selectedCoverage * 100).toFixed(1)}% spread=${(cell.coverageSpread * 100).toFixed(1)}pp ` +
      `carried=${cell.carried}/${cell.figuresTotal} ` +
      `notSel=${cell.verdicts.not_selected} notWr=${cell.verdicts.not_written} guard=${cell.verdicts.guard_dropped} ` +
      `viol/pt=${cell.violationsPerPoint.toFixed(3)} failed=${cell.failedRuns}`,
  );
}
console.log(
  "violations:",
  violationTotals(scores)
    .map((v) => `${v.code}=${v.count}`)
    .join(" "),
);
