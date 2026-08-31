import cases from "./corpus/cases.json";
import { runMatrix, type Cell } from "./src/matrix.js";
import { MODEL_VARIANTS } from "./src/variants.js";
import type { EvalCase } from "./src/types.js";

const cells: Cell[] = MODEL_VARIANTS.map((model) => ({
  model,
  promptVariant: "P0" as const,
}));

await runMatrix(cases as EvalCase[], cells, 3, "./results/stage1.jsonl", 6);
