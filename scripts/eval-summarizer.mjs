import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  MAX_POINTS_PER_ARTICLE,
  MAX_POINT_LENGTH,
} from "../packages/shared/email-templates/src/newsletter/newsletter-document.js";
import {
  SUMMARIZE_ARTICLE_SYSTEM_PROMPT,
  buildArticlePrompt,
} from "../apps/mediapulse/agents/content-generation/src/summarize-article.js";
import {
  ResponseCache,
  callSummarizer,
  checkStructure,
  mapWithConcurrency,
  requireEnv,
  screenFigures,
  scoreModel,
} from "./lib/summarizer-eval.mjs";

const CASES_PATH = fileURLToPath(
  new URL("./lib/summarizer.cases.json", import.meta.url),
);
const CACHE_DIR = fileURLToPath(
  new URL("../.eval-cache/summarizer", import.meta.url),
);

/** Per-source truncation applied by content-generation before the summarizer sees an article. */
const MAX_CHARS_PER_SOURCE = 8000;

const DEFAULT_MODELS = [
  "openai/gpt-4.1-mini",
  "qwen/qwen3.5-flash-02-23",
  "deepseek/deepseek-v4-flash",
];

const EVAL_CONCURRENCY = 8;

const parseArgs = (argv) => {
  const options = { models: DEFAULT_MODELS, json: null, noCache: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--models") {
      options.models = (argv[index + 1] ?? "").split(",").filter(Boolean);
      index += 1;
    } else if (arg === "--json") {
      options.json = argv[index + 1] ?? "summarizer-eval.json";
      index += 1;
    } else if (arg === "--no-cache") {
      options.noCache = true;
    }
  }

  return options;
};

const pct = (value) => `${(value * 100).toFixed(1)}%`;

const main = async () => {
  const options = parseArgs(process.argv.slice(2));
  const apiKey = requireEnv("OPENROUTER_API_KEY");
  const baseUrl =
    process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1";
  const cache = options.noCache ? undefined : new ResponseCache(CACHE_DIR);

  const cases = JSON.parse(readFileSync(CASES_PATH, "utf8")).map(
    (testCase) => ({
      ...testCase,
      content: testCase.content.slice(0, MAX_CHARS_PER_SOURCE),
    }),
  );

  const restatementOnly = cases.filter((c) => c.restatementOnly).length;
  const bodyCases = cases.filter((c) => c.arm === "body").length;
  console.log(
    `${String(cases.length)} cases: ${String(bodyCases)} with a body, ` +
      `${String(cases.length - bodyCases)} description-only ` +
      `(${String(restatementOnly)} of those restate the headline and must return no points)\n`,
  );

  const report = { models: {}, generatedAt: new Date().toISOString() };

  for (const model of options.models) {
    const outputs = await mapWithConcurrency(
      cases,
      EVAL_CONCURRENCY,
      async (testCase) => {
        const result = await callSummarizer({
          apiKey,
          baseUrl,
          model,
          systemPrompt: SUMMARIZE_ARTICLE_SYSTEM_PROMPT,
          userPrompt: `${buildArticlePrompt({ title: testCase.title, content: testCase.content })}\n\nReturn JSON only: {"title": "<English title>", "points": ["<point>", ...]}. An empty points array is a valid and expected answer.`,
          cache,
        });

        return {
          ...result,
          structure: checkStructure(result.points, {
            maxPoints: MAX_POINTS_PER_ARTICLE,
            maxPointLength: MAX_POINT_LENGTH,
          }),
          flags: screenFigures(result.points, testCase.content),
        };
      },
    );

    const score = scoreModel(outputs, cases);
    report.models[model] = { score, outputs };

    console.log(
      `${model}\n` +
        `  restraint            ${String(score.restraintCorrect)}/${String(score.restraintTotal)} (${pct(score.restraintRate)}) correctly returned no points\n` +
        `  spurious points      ${String(score.spuriousPoints)} written from a headline restatement\n` +
        `  thin-source points   ${String(score.legitimateDescriptionPoints)} from descriptions that do carry a fact\n` +
        `  body points          ${String(score.bodyPoints)} (${score.bodyPointsPerCase.toFixed(2)} per article)\n` +
        `  structure violations ${String(score.structureViolations)}\n` +
        `  figures to check     ${String(score.figureFlags)}\n` +
        `  transport failures   ${String(score.failures)}\n` +
        `  cost                 $${score.cost.toFixed(5)}\n`,
    );

    for (const [index, output] of outputs.entries()) {
      for (const violation of output.structure) {
        console.log(`    structure  ${cases[index].symbol}  ${violation}`);
      }
      for (const flag of output.flags) {
        console.log(
          `    figure     ${cases[index].symbol}  [${flag.figure}] ${flag.point.slice(0, 80)}`,
        );
      }
    }
  }

  if (cache !== undefined) {
    const { hits, misses } = cache.stats;
    console.log(`cache: ${String(hits)} hits, ${String(misses)} misses`);
  }

  if (options.json !== null) {
    writeFileSync(options.json, JSON.stringify(report, null, 2), "utf8");
    console.log(`wrote ${options.json}`);
  }

  console.log(
    "\nRestraint and structure are scored automatically. Bullet quality is not: read the\n" +
      "outputs before preferring one model over another on substance.",
  );
};

await main();
