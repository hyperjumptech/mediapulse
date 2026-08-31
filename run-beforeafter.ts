import { writeFileSync } from "node:fs";

import cases from "./corpus/cases.json";
import { replayCase } from "./src/replay.js";
import { PROMPT_VARIANTS } from "./src/variants.js";
import type { EvalCase } from "./src/types.js";

const ARTICLE_ID = "1998715";
const MODEL = "openai/gpt-4.1-mini";
const REPEATS = Number.parseInt(process.env.REPEATS ?? "5", 10);

const joined = process.argv.includes("--joined");
const outPath = process.argv[2] ?? "./results/before.json";

const target = structuredClone(
  (cases as EvalCase[]).find(
    (c) => c.symbol === "DCII" && c.run_at.startsWith("2026-08-31"),
  ),
) as EvalCase;

const pageOne = (cases as EvalCase[])
  .flatMap((c) => c.pool)
  .find(
    (a) => a.url.includes(ARTICLE_ID) && !/\/(?:\d{1,3}|All)$/iu.test(a.url),
  );

if (joined) {
  const target_article = target.pool.find((a) => a.url.includes(ARTICLE_ID));
  if (target_article && pageOne) {
    const tail = target_article.content
      .split("\n")
      .filter(
        (line) => !pageOne.content.includes(line.trim()) || line.trim() === "",
      )
      .join("\n");
    target_article.content = `${pageOne.content.trim()}\n\n${tail.trim()}`;
    target_article.url = pageOne.url;
  }
}

const runs = [];
for (let repeat = 0; repeat < REPEATS; repeat += 1) {
  const outcome = await replayCase(target, MODEL, PROMPT_VARIANTS.P0, repeat);
  const doc: any = outcome.document;
  runs.push({
    repeat,
    status: outcome.status,
    subject: outcome.subject,
    raw: outcome.summarizerCalls
      .filter((c) => c.articleTitle.includes("DCI Indonesia"))
      .map((c) => c.rawSummary),
    shipped: (doc?.sections ?? []).flatMap((s: any) =>
      (s.articles ?? []).map((a: any) => ({
        title: a.title,
        url: a.url,
        points: a.points,
      })),
    ),
  });
}

const article = target.pool.find((a) => a.url.includes(ARTICLE_ID));
writeFileSync(
  outPath,
  JSON.stringify(
    {
      mode: joined ? "after" : "before",
      articleUrl: article?.url,
      articleChars: article?.content.length,
      runs,
    },
    null,
    2,
  ),
);
console.log(
  `${joined ? "AFTER" : "BEFORE"} -> ${outPath} (article ${String(article?.content.length)} chars)`,
);
for (const run of runs) {
  const dcii = run.shipped.find((s: any) => s.url.includes(ARTICLE_ID));
  console.log(`  run ${run.repeat}: ${dcii ? dcii.points.length : 0} points`);
  for (const p of dcii?.points ?? []) console.log(`     - ${p}`);
}
