#!/usr/bin/env node

import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const PATTERNS = [
  { label: "collectionSource", regex: /collectionSource/ },
  {
    label: "mediapulse slug branch",
    regex: /integrationId\s*===\s*["']mediapulse["']/,
  },
  { label: "closed table-v1 filter enum", regex: /tableV1ListFilterKeySchema/ },
  { label: "mediapulse string", regex: /\bmediapulse\b/i },
  { label: "@mediapulse import", regex: /@mediapulse\// },
  { label: "ticker", regex: /ticker/i },
];

const SCAN_DIRS = ["packages/hermes", "apps/hermes"];

const SKIPPED_DIRECTORIES = new Set([
  "node_modules",
  ".next",
  ".turbo",
  "dist",
  "build",
  "coverage",
  "generated",
  ".generated",
]);

const SCANNED_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs"]);

const ALLOWLIST = [
  /\.test\.[tj]sx?$/,
  /\.contract\.test\.[tj]sx?$/,
  /[/\\]test-utils[/\\]/,
  /orchestration-database[/\\]prisma\.config\.ts$/,
];

const listSourceFiles = (directory) => {
  const files = [];
  for (const entry of readdirSync(directory)) {
    if (SKIPPED_DIRECTORIES.has(entry)) {
      continue;
    }
    const entryPath = path.join(directory, entry);
    if (statSync(entryPath).isDirectory()) {
      files.push(...listSourceFiles(entryPath));
      continue;
    }
    if (SCANNED_EXTENSIONS.has(path.extname(entry))) {
      files.push(entryPath);
    }
  }

  return files;
};

const findHits = () => {
  const hits = [];
  for (const scanDirectory of SCAN_DIRS) {
    for (const filePath of listSourceFiles(
      path.join(repoRoot, scanDirectory),
    )) {
      const relativePath = path.relative(repoRoot, filePath);
      if (ALLOWLIST.some((pattern) => pattern.test(relativePath))) {
        continue;
      }
      const lines = readFileSync(filePath, "utf8").split("\n");
      lines.forEach((line, index) => {
        for (const { label, regex } of PATTERNS) {
          if (regex.test(line)) {
            hits.push(
              `[${label}] ${relativePath}:${index + 1}: ${line.trim()}`,
            );
          }
        }
      });
    }
  }

  return hits;
};

const hits = findHits();
if (hits.length > 0) {
  console.error(`Hermes domain separation check failed:\n${hits.join("\n")}`);
  process.exit(1);
}

console.log("Hermes domain separation check passed.");
