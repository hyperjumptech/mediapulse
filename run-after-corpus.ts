import cases from "./corpus/cases.json";
import { runMatrix, type Cell } from "./src/matrix.js";
import type { EvalCase } from "./src/types.js";

const cells: Cell[] = [{ model: "openai/gpt-4.1-mini", promptVariant: "P0" }];
await runMatrix(
  cases as EvalCase[],
  cells,
  3,
  "./results/after-corpus.jsonl",
  6,
);
