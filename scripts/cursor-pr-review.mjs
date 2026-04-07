import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import process from "node:process";

import {
  parseGitDiffNameStatus,
  runCursorPrReview,
} from "./lib/cursor-pr-review.mjs";

const getArgValue = (name, defaultValue) => {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return defaultValue;
  const value = process.argv[idx + 1];
  if (!value || value.startsWith("--")) return defaultValue;
  return value;
};

const hasFlag = (name) => process.argv.includes(`--${name}`);

const baseRef = getArgValue("base", "main");
const headRef = getArgValue("head", "HEAD");
const failOnWarnings = hasFlag("fail-on-warnings");

const listChangedFiles = async ({ baseRef: base, headRef: head }) => {
  const stdout = execFileSync(
    "git",
    ["diff", "--name-status", `${base}...${head}`],
    { encoding: "utf8" },
  );

  return parseGitDiffNameStatus(stdout);
};

/**
 * Reads the version of a path at `headRef` so reviews work even when the
 * working tree is not checked out to the PR head (matches CI).
 *
 * @param {string} filePath
 * @returns {Promise<string>}
 */
const readTextFile = async (filePath) => {
  const posixPath = filePath.replaceAll("\\", "/");
  try {
    return execFileSync("git", ["show", `${headRef}:${posixPath}`], {
      encoding: "utf8",
      maxBuffer: 50 * 1024 * 1024,
    });
  } catch (gitErr) {
    try {
      return await readFile(filePath, "utf8");
    } catch {
      throw new Error(
        `cursor-pr-review: cannot read "${posixPath}" at "${headRef}" (${String(gitErr)})`,
        { cause: gitErr },
      );
    }
  }
};

const printFindings = (findings) => {
  if (findings.length === 0) {
    // eslint-disable-next-line no-console
    console.log("cursor-pr-review: OK");
    return;
  }

  // eslint-disable-next-line no-console
  console.log("cursor-pr-review: findings");
  for (const f of findings) {
    const pathPart = f.filePath
      ? f.line !== undefined
        ? ` (${f.filePath}:${f.line})`
        : ` (${f.filePath})`
      : "";
    // eslint-disable-next-line no-console
    console.log(`- [${f.severity}] ${f.ruleId}${pathPart}: ${f.message}`);
  }
};

const main = async () => {
  const result = await runCursorPrReview(
    { listChangedFiles, readTextFile },
    {
      baseRef,
      headRef,
    },
  );

  printFindings(result.findings);

  const hasErrors = result.findings.some((f) => f.severity === "error");
  const hasWarnings = result.findings.some((f) => f.severity === "warning");

  if (hasErrors || (failOnWarnings && hasWarnings)) {
    process.exitCode = 1;
  }
};

await main();
