#!/usr/bin/env node
/**
 * Captures Hermes MCP API keys UI fixture screenshots (#496 / PR #506).
 * Prerequisites: `pnpm dev:hermes` on port 3001, `npx playwright install chromium` once.
 */

import { spawnSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
const outDir = join(repoRoot, "artifacts/ui-evidence/hermes-mcp-496");
const baseUrl = "http://localhost:3001/dev/ui/hermes-mcp-api-keys";
const playwrightCli = ["--yes", "playwright@1.51.0"];

/**
 * @param {string[]} args
 * @returns {number}
 */
const runPlaywright = (args) => {
  const result = spawnSync("npx", [...playwrightCli, ...args], {
    stdio: "inherit",
  });
  return result.status ?? 1;
};

await mkdir(outDir, { recursive: true });

const shots = [
  {
    variant: "empty",
    file: "496-api-keys-empty-list.png",
    waitFor: "table",
  },
  {
    variant: "list",
    file: "496-api-keys-list-with-created-by.png",
    waitFor: "table",
  },
  {
    variant: "create-modal",
    file: "496-api-keys-create-modal.png",
    waitFor: "#mcp-key-label",
  },
];

for (const { variant, file, waitFor } of shots) {
  const url = `${baseUrl}?variant=${variant}`;
  const outPath = join(outDir, file);
  const status = runPlaywright([
    "screenshot",
    url,
    outPath,
    `--wait-for-selector=${waitFor}`,
    "--viewport-size=1280,900",
  ]);
  if (status !== 0) {
    process.exit(status);
  }
  console.log(`wrote ${file}`);
}
