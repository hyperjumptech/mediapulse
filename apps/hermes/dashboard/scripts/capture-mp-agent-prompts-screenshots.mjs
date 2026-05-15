#!/usr/bin/env node
/**
 * Captures mp-agent-prompts Hermes fixture screenshots (prompts textareas only).
 * Prerequisites: `pnpm dev:hermes` on port 3001.
 *
 * Usage: node apps/hermes/dashboard/scripts/capture-mp-agent-prompts-screenshots.mjs
 */

import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const outDir = join(
  repoRoot,
  "artifacts/ui-evidence/mp-agent-prompts-hermes",
);
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

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

await mkdir(outDir, { recursive: true });

for (const { agent, file } of shots) {
  const url = `${baseUrl}?agent=${agent}&focus=prompts`;
  await page.goto(url, { waitUntil: "networkidle" });
  const textareas = page.locator("textarea");
  await textareas.first().waitFor({ state: "visible", timeout: 30_000 });
  const count = await textareas.count();
  if (count < 2) {
    throw new Error(
      `Expected at least 2 prompt textareas on ${url}, found ${count}`,
    );
  }
  await page.locator('[data-visual-proof="prompts"]').screenshot({
    path: join(outDir, file),
  });
  console.log(`wrote ${file} (${count} textareas)`);
}

await browser.close();
