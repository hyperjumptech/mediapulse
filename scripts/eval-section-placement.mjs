import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { articleAnalysisConfigSchema } from "../apps/mediapulse/agents/article-analysis/src/config-schema.js";
import { classifyArticleSection } from "../apps/mediapulse/agents/article-analysis/src/llm-classify-section.js";

const CASES_PATH = fileURLToPath(
  new URL("./lib/section-placement.cases.json", import.meta.url),
);

const requireEnv = (name) => {
  const value = process.env[name];
  if (value === undefined || value.trim() === "") {
    throw new Error(`${name} is required to run this eval`);
  }

  return value;
};

const EVAL_CONCURRENCY = 6;

const mapWithConcurrency = async (items, limit, worker) => {
  const results = new Array(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, () =>
    (async () => {
      for (;;) {
        const index = next;
        next += 1;
        const item = items[index];
        if (item === undefined) {
          return;
        }
        results[index] = await worker(item, index);
      }
    })(),
  );
  await Promise.all(runners);

  return results;
};

const main = async () => {
  const apiKey = requireEnv("OPENROUTER_API_KEY");
  const model = process.env.EVAL_MODEL ?? "openai/gpt-4o-mini";
  const baseUrl =
    process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1";
  const repeats = Number.parseInt(process.env.EVAL_REPEATS ?? "1", 10);
  const cases = JSON.parse(readFileSync(CASES_PATH, "utf8"));
  const { acceptanceCriteria } = articleAnalysisConfigSchema.parse({});

  const classifyOne = async (testCase) => {
    const ticker = {
      symbol: testCase.symbol,
      name: testCase.tickerName,
      sector: null,
      industry: testCase.industry,
      subIndustry: testCase.subIndustry,
      businessActivity: null,
      aliases: testCase.aliases.split(", ").filter(Boolean),
      competitors: testCase.competitors.split(", ").filter(Boolean),
      regulators: [],
    };
    const result = await classifyArticleSection({
      apiKey,
      baseUrl,
      model,
      title: testCase.title,
      content: testCase.content,
      acceptanceCriteria,
      ticker,
      tickerContext: `Issuer context: collected for ${testCase.symbol} (${testCase.tickerName}), industry ${testCase.industry}, ${testCase.subIndustry}.`,
    });

    return result.section;
  };

  const accuracies = [];
  for (let run = 0; run < repeats; run += 1) {
    const actuals = await mapWithConcurrency(
      cases,
      EVAL_CONCURRENCY,
      classifyOne,
    );
    let correct = 0;
    let falseNegatives = 0;
    let falsePositives = 0;
    const rows = [];

    cases.forEach((testCase, index) => {
      const actual = actuals[index] ?? null;
      const expected = testCase.expectedSection;
      const hit = actual === expected;
      if (hit) {
        correct += 1;
      }
      if (expected !== null && actual === null) {
        falseNegatives += 1;
      }
      if (expected === null && actual !== null) {
        falsePositives += 1;
      }
      const body = testCase.content.trim().length > 0 ? "body" : "TITLE-ONLY";
      rows.push(
        `${hit ? "PASS" : "FAIL"}  ${testCase.symbol.padEnd(5)} ${body.padEnd(10)} expected=${String(expected ?? "REJECT").padEnd(22)} actual=${String(actual ?? "REJECT").padEnd(22)} ${testCase.title.slice(0, 44)}`,
      );
    });

    if (repeats === 1) {
      for (const row of rows) {
        console.log(row);
      }
    }
    accuracies.push(correct / cases.length);
    console.log(
      `run ${String(run + 1)}: ${String(correct)}/${String(cases.length)} ` +
        `(${((correct / cases.length) * 100).toFixed(1)}%)  ` +
        `wrongly-rejected=${String(falseNegatives)} wrongly-accepted=${String(falsePositives)}`,
    );
  }

  const titleOnly = cases.filter(
    (testCase) => testCase.content.trim().length === 0,
  ).length;
  const mean = accuracies.reduce((sum, value) => sum + value, 0) / repeats;
  const lowest = Math.min(...accuracies);
  const highest = Math.max(...accuracies);
  console.log(
    `\nmodel=${model}  runs=${String(repeats)}` +
      `\nmean accuracy: ${(mean * 100).toFixed(1)}%  range: ${(lowest * 100).toFixed(1)}%-${(highest * 100).toFixed(1)}%` +
      `\ntitle-only cases: ${String(titleOnly)}/${String(cases.length)}` +
      `\n\nA change is only meaningful if it moves the mean beyond this range.`,
  );
};

await main();
