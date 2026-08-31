import cases from "./corpus/cases.json";
import { runMatrix, type Cell } from "./src/matrix.js";
import type { EvalCase } from "./src/types.js";

const cells: Cell[] = [];
for (const model of ["openai/gpt-4.1-mini", "openai/gpt-4.1-nano"]) {
  for (const promptVariant of ["P1", "P2", "P3"] as const) {
    cells.push({ model, promptVariant });
  }
}

await runMatrix(cases as EvalCase[], cells, 3, "./results/stage2.jsonl", 6);
