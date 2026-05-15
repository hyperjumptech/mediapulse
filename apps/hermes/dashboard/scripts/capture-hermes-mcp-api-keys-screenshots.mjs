#!/usr/bin/env node
/**
 * Captures Hermes MCP API keys UI fixture screenshots (#496).
 * Prerequisites: `pnpm dev:hermes` on port 3001, `npx playwright install chromium` once.
 */

import { spawnSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const outDir = join(repoRoot, "artifacts/ui-evidence/hermes-mcp-496");
const baseUrl = "http://127.0.0.1:3001/dev/ui/hermes-mcp-api-keys";

const shots = [
  { variant: "empty", file: "496-api-keys-empty-list.png" },
  { variant: "list", file: "496-api-keys-list-with-created-by.png" },
];

await mkdir(outDir, { recursive: true });

for (const { variant, file } of shots) {
  const url = `${baseUrl}?variant=${variant}`;
  const outPath = join(outDir, file);
  const result = spawnSync(
    "npx",
    [
      "--yes",
      "playwright@1.51.0",
      "screenshot",
      url,
      outPath,
      "--wait-for-selector=table",
      "--viewport-size=1280,900",
    ],
    { stdio: "inherit" },
  );
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
  console.log(`wrote ${file}`);
}
