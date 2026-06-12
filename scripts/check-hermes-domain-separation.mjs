#!/usr/bin/env node
/**
 * Fails when Hermes production code encodes Mediapulse-specific domain semantics.
 */

import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const PATTERNS = [
  { label: "collectionSource", regex: "collectionSource" },
  {
    label: "mediapulse slug branch",
    regex: "integrationId\\s*===\\s*[\"']mediapulse[\"']",
  },
  {
    label: "closed table-v1 filter enum",
    regex: "tableV1ListFilterKeySchema",
  },
];

const SCAN_DIRS = ["packages/hermes", "apps/hermes"];
const ALLOWLIST = [
  /\.test\.[tj]sx?$/,
  /\.mdx?$/,
  /README\.md$/,
  /hermes-domain-separation\.mdc$/,
  /env\.example$/,
  /env\..*\.example$/,
];

const run = () => {
  const hits = [];
  for (const { label, regex } of PATTERNS) {
    for (const dir of SCAN_DIRS) {
      let output = "";
      try {
        output = execSync(`rg -n --pcre2 "${regex}" ${dir} || true`, {
          cwd: repoRoot,
          encoding: "utf8",
        });
      } catch {
        continue;
      }
      for (const line of output.split("\n").filter(Boolean)) {
        const file = line.split(":")[0];
        if (ALLOWLIST.some((re) => re.test(file))) {
          continue;
        }
        hits.push(`[${label}] ${line}`);
      }
    }
  }

  if (hits.length > 0) {
    console.error("Hermes domain separation check failed:\n", hits.join("\n"));
    process.exit(1);
  }

  console.log("Hermes domain separation check passed.");
};

run();
