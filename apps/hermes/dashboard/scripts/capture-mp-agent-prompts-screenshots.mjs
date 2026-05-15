#!/usr/bin/env node
/**
 * Captures mp-agent-prompts Hermes fixture screenshots (prompts textareas only).
 * Prerequisites: `pnpm dev:hermes` on port 3001, `npx playwright install chromium` once.
 *
 * Usage: node apps/hermes/dashboard/scripts/capture-mp-agent-prompts-screenshots.mjs
 */

import { spawnSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const outDir = join(repoRoot, "artifacts/ui-evidence/mp-agent-prompts-hermes");
const baseUrl = "http://127.0.0.1:3001/dev/ui/mp-agent-prompts-hermes";

const shots = [
  {
    agent: "article-analysis",
    file: "478-article-analysis-prompts-textarea.png",
  },
  { agent: "query-analysis", file: "480-query-analysis-prompts-textarea.png" },
  {
    agent: "content-generation",
    file: "481-content-generation-prompts-textarea.png",
  },
];

await mkdir(outDir, { recursive: true });

for (const { agent, file } of shots) {
  const url = `${baseUrl}?agent=${agent}&focus=prompts`;
  const outPath = join(outDir, file);
  const result = spawnSync(
    "npx",
    [
      "--yes",
      "playwright@1.51.0",
      "screenshot",
      url,
      outPath,
      "--wait-for-selector=textarea",
      "--viewport-size=1280,720",
    ],
    { stdio: "inherit" },
  );
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
  console.log(`wrote ${file}`);
}
