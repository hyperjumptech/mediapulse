#!/usr/bin/env node
/**
 * Records #521 proof: validateWithJsonSchema accepts textarea format on prompts.
 * Prerequisites: `pnpm dev:hermes` on port 3001, `npx playwright install chromium` once.
 */

import { spawnSync } from "node:child_process";
import { mkdir, readdir, rename } from "node:fs/promises";
import { mkdtemp } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import process from "node:process";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
const outDir = join(
  repoRoot,
  "artifacts/ui-evidence/agent-config-textarea-save-521",
);
const url = "http://127.0.0.1:3001/dev/ui/agent-config-textarea-save";

const workDir = await mkdtemp(join(tmpdir(), "pw-521-"));
const install = spawnSync(
  "npm",
  ["install", "--no-save", "playwright@1.51.0"],
  { cwd: workDir, stdio: "inherit" },
);
if (install.status !== 0) {
  process.exit(install.status ?? 1);
}

const playwright = await import(
  pathToFileURL(join(workDir, "node_modules/playwright/index.js")).href
);
const { chromium } = playwright.default;

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  recordVideo: {
    dir: outDir,
    size: { width: 1280, height: 900 },
  },
});
const page = await context.newPage();

try {
  await page.goto(url, { waitUntil: "networkidle" });
  await page.getByTestId("save-result").waitFor({ timeout: 15_000 });
  const text = await page.getByTestId("save-result").textContent();
  if (!text?.includes("Config saved successfully")) {
    throw new Error(`Unexpected result: ${text ?? "(empty)"}`);
  }
  await page.waitForTimeout(1500);
} catch (error) {
  await page.screenshot({ path: join(outDir, "failure.png"), fullPage: true });
  throw error;
} finally {
  await context.close();
  await browser.close();
}

const videoPath = join(outDir, "521-agent-config-textarea-save.webm");
const entries = await readdir(outDir);
const webm = entries.find((f) => f.endsWith(".webm"));
if (webm && webm !== "521-agent-config-textarea-save.webm") {
  await rename(join(outDir, webm), videoPath);
}

console.log(`Recorded video: ${videoPath}`);
