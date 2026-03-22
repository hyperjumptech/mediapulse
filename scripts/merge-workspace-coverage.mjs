#!/usr/bin/env node
/**
 * Finds every package `coverage/coverage-final.json` under `apps/` and `packages/`,
 * merges them into one Istanbul coverage map, and writes a combined report under
 * `coverage/workspace/` at the repo root.
 */

import istanbulCoverage from "istanbul-lib-coverage";
import istanbulReport from "istanbul-lib-report";
import reports from "istanbul-reports";

const { createCoverageMap } = istanbulCoverage;
const { createContext } = istanbulReport;
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const COVERAGE_FINAL = "coverage-final.json";

/**
 * @param {string} value
 * @returns {string}
 */
const escapeHtml = (value) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

/**
 * @param {string | number} pct
 * @returns {string}
 */
const formatPct = (pct) =>
  typeof pct === "number" ? pct.toFixed(2) : String(pct);

/**
 * @param {{ lines: { pct: string | number }; statements: { pct: string | number }; branches: { pct: string | number }; functions: { pct: string | number } }} summary
 * @returns {{ lines: string, statements: string, branches: string, functions: string }}
 */
const summaryToCells = (summary) => ({
  lines: formatPct(summary.lines.pct),
  statements: formatPct(summary.statements.pct),
  branches: formatPct(summary.branches.pct),
  functions: formatPct(summary.functions.pct),
});

/**
 * @param {string} repoRoot
 * @param {string} outputDir
 * @param {string[]} coverageFinalPaths
 * @returns {Promise<void>}
 */
const writePackagesIndexHtml = async (
  repoRoot,
  outputDir,
  coverageFinalPaths,
) => {
  /** @type {Array<{ rel: string; href: string; cells: ReturnType<typeof summaryToCells> }>} */
  const rows = [];

  for (const finalPath of coverageFinalPaths) {
    const packageRoot = dirname(dirname(finalPath));
    const rel = relative(repoRoot, packageRoot);
    const raw = await readFile(finalPath, "utf8");
    const pkgMap = createCoverageMap(JSON.parse(raw));
    const summary = pkgMap.getCoverageSummary();
    const href = relative(
      outputDir,
      join(packageRoot, "coverage", "index.html"),
    ).replaceAll("\\", "/");
    rows.push({ rel, href, cells: summaryToCells(summary) });
  }

  rows.sort((a, b) => a.rel.localeCompare(b.rel));

  const tableRows = rows
    .map(
      (row) => `            <tr>
                <td class="path">${escapeHtml(row.rel)}</td>
                <td class="pct">${row.cells.lines}</td>
                <td class="pct">${row.cells.statements}</td>
                <td class="pct">${row.cells.branches}</td>
                <td class="pct">${row.cells.functions}</td>
                <td><a href="${escapeHtml(row.href)}">Open report</a></td>
            </tr>`,
    )
    .join("\n");

  const html = `<!doctype html>
<html lang="en">
<head>
    <title>Coverage by package</title>
    <meta charset="utf-8" />
    <link rel="stylesheet" href="base.css" />
    <link rel="shortcut icon" type="image/x-icon" href="favicon.png" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style type="text/css">
        .packages-table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
        .packages-table th, .packages-table td { text-align: left; padding: 0.35rem 0.5rem; border-bottom: 1px solid #eee; }
        .packages-table th { font-weight: 600; }
        .packages-table td.pct { font-family: monospace; }
        .packages-table td.path { font-family: monospace; font-size: 0.9em; }
        .nav { margin: 0.5rem 0 1rem; }
    </style>
</head>
<body>
<div class="wrapper">
    <div class="pad1">
        <h1>Coverage by package</h1>
        <p class="quiet">Per-workspace totals from each package’s own <code>coverage/coverage-final.json</code>. Links open that package’s Vitest HTML report on disk.</p>
        <div class="nav quiet">
            <a href="index.html">Combined file list</a>
        </div>
        <table class="packages-table" aria-label="Coverage summary per package">
            <thead>
                <tr>
                    <th scope="col">Package</th>
                    <th scope="col">Lines %</th>
                    <th scope="col">Statements %</th>
                    <th scope="col">Branches %</th>
                    <th scope="col">Functions %</th>
                    <th scope="col">Report</th>
                </tr>
            </thead>
            <tbody>
${tableRows}
            </tbody>
        </table>
    </div>
</div>
</body>
</html>
`;

  await writeFile(join(outputDir, "packages-index.html"), html, "utf8");
};

/**
 * @param {string} indexPath
 * @returns {Promise<void>}
 */
const injectCombinedNavLink = async (indexPath) => {
  let html = await readFile(indexPath, "utf8");
  const needle = "<h1>All files</h1>";
  if (!html.includes(needle)) {
    return;
  }
  const replacement = `${needle}
        <p class="quiet pad1"><a href="packages-index.html">Coverage by package</a></p>`;
  html = html.replace(needle, replacement);
  await writeFile(indexPath, html, "utf8");
};

/**
 * @param {string} dir
 * @returns {Promise<string[]>}
 */
const findCoverageFinalJsonFiles = async (dir) => {
  /** @type {string[]} */
  const results = [];

  /**
   * @param {string} current
   * @returns {Promise<void>}
   */
  const walk = async (current) => {
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      return;
    }

    for (const ent of entries) {
      const full = join(current, ent.name);
      if (ent.isDirectory()) {
        if (ent.name === "node_modules") {
          continue;
        }
        await walk(full);
      } else if (
        ent.name === COVERAGE_FINAL &&
        basename(current) === "coverage"
      ) {
        results.push(full);
      }
    }
  };

  await walk(dir);
  return results;
};

/**
 * @param {string} repoRoot
 * @returns {Promise<string[]>}
 */
const collectCoverageFiles = async (repoRoot) => {
  const appsDir = join(repoRoot, "apps");
  const packagesDir = join(repoRoot, "packages");

  const [fromApps, fromPackages] = await Promise.all([
    findCoverageFinalJsonFiles(appsDir),
    findCoverageFinalJsonFiles(packagesDir),
  ]);

  return [...fromApps, ...fromPackages].sort((a, b) => a.localeCompare(b));
};

const scriptDir = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = join(scriptDir, "..");
const outputDir = join(repoRoot, "coverage", "workspace");

const files = await collectCoverageFiles(repoRoot);

if (files.length === 0) {
  console.warn(
    "merge-workspace-coverage: no coverage/coverage-final.json files found under apps/ or packages/. Run `pnpm test:coverage` (or `pnpm code-quality`) first.",
  );
  process.exit(0);
}

const map = createCoverageMap({});

for (const path of files) {
  const raw = await readFile(path, "utf8");
  const data = JSON.parse(raw);
  map.merge(createCoverageMap(data));
}

await mkdir(outputDir, { recursive: true });

const context = createContext({
  dir: outputDir,
  coverageMap: map,
});

reports.create("html", { subdir: "." }).execute(context);
reports
  .create("json-summary", { file: "coverage-summary.json" })
  .execute(context);
reports.create("json", { file: "coverage-final.json" }).execute(context);

await writePackagesIndexHtml(repoRoot, outputDir, files);
await injectCombinedNavLink(join(outputDir, "index.html"));

console.log(
  `merge-workspace-coverage: merged ${String(files.length)} coverage file(s) → ${outputDir}`,
);
console.log(`  Combined HTML: ${join(outputDir, "index.html")}`);
console.log(`  By package:    ${join(outputDir, "packages-index.html")}`);
console.log(`  JSON summary:  ${join(outputDir, "coverage-summary.json")}`);
