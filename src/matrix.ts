import { appendFileSync, existsSync, readFileSync } from "node:fs";

import { replayCase } from "./replay.js";
import { scoreCase, type CaseScore } from "./assertions.js";
import { PROMPT_VARIANTS, type PromptVariantId } from "./variants.js";
import type { EvalCase } from "./types.js";

export type Cell = { model: string; promptVariant: PromptVariantId };

const cellKey = (score: {
  caseId: string;
  model: string;
  promptVariant: string;
  repeat: number;
}): string =>
  `${score.model}|${score.promptVariant}|${score.caseId}|${String(score.repeat)}`;

const loadDone = (path: string): Set<string> => {
  if (!existsSync(path)) {
    return new Set();
  }

  return new Set(
    readFileSync(path, "utf8")
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => cellKey(JSON.parse(line) as CaseScore)),
  );
};

export const runMatrix = async (
  cases: EvalCase[],
  cells: Cell[],
  repeats: number,
  outputPath: string,
  concurrency = 6,
): Promise<void> => {
  const done = loadDone(outputPath);
  const jobs: { evalCase: EvalCase; cell: Cell; repeat: number }[] = [];

  for (const cell of cells) {
    for (const evalCase of cases) {
      for (let repeat = 0; repeat < repeats; repeat += 1) {
        const key = `${cell.model}|${cell.promptVariant}|${evalCase.case_id}|${String(repeat)}`;
        if (!done.has(key)) {
          jobs.push({ evalCase, cell, repeat });
        }
      }
    }
  }

  console.error(
    `queued ${String(jobs.length)} replays (${String(done.size)} already done)`,
  );

  let index = 0;
  let completed = 0;
  const worker = async (): Promise<void> => {
    while (index < jobs.length) {
      const job = jobs[index];
      index += 1;
      if (job === undefined) {
        return;
      }
      const variant = PROMPT_VARIANTS[job.cell.promptVariant];
      const outcome = await replayCase(
        job.evalCase,
        job.cell.model,
        variant,
        job.repeat,
      );
      const score = scoreCase(
        job.evalCase,
        outcome,
        variant.suppliesReferenceRate,
      );
      appendFileSync(outputPath, `${JSON.stringify(score)}\n`);
      completed += 1;
      if (completed % 20 === 0) {
        console.error(`  ${String(completed)}/${String(jobs.length)}`);
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(concurrency, jobs.length) }, () => worker()),
  );
  console.error(`done: ${String(completed)} replays`);
};
