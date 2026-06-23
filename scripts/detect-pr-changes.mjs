import { appendFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import process from "node:process";

import {
  buildDeployMatrix,
  detectDockerServices,
  detectPrChanges,
} from "./lib/detect-pr-changes.mjs";

/**
 * Reads a CLI flag value.
 *
 * @param {string} name
 * @param {string | null} defaultValue
 * @returns {string | null}
 */
const getArgValue = (name, defaultValue) => {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return defaultValue;
  const value = process.argv[idx + 1];
  if (!value || value.startsWith("--")) return defaultValue;
  return value;
};

/**
 * Lists changed file paths between two git refs.
 *
 * @param {string} baseSha
 * @param {string} headSha
 * @returns {string[]}
 */
const listChangedFiles = (baseSha, headSha) => {
  const stdout = execFileSync(
    "git",
    ["diff", "--name-only", baseSha, headSha],
    { encoding: "utf8" },
  );

  return stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
};

/**
 * Writes GitHub Actions output lines.
 *
 * @param {Record<string, string>} outputs
 */
const writeGithubOutput = (outputs) => {
  const outputPath = process.env.GITHUB_OUTPUT;
  const lines = Object.entries(outputs)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  if (outputPath) {
    appendFileSync(outputPath, `${lines}\n`);
    return;
  }

  for (const line of lines.split("\n")) {
    // eslint-disable-next-line no-console
    console.log(line);
  }
};

const format = getArgValue("format", "gha");
const eventName = getArgValue("event", process.env.EVENT_NAME ?? "pull_request");
const baseSha = getArgValue("base", process.env.PR_BASE_SHA ?? "");
const headSha = getArgValue("head", process.env.PR_HEAD_SHA ?? "HEAD");
const workflow = getArgValue("workflow", "all");

const changedFiles = listChangedFiles(baseSha, headSha);
const result = detectPrChanges({ changedFiles, eventName, baseSha, headSha });

if (format === "json") {
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ changedFiles, ...result }, null, 2));
  process.exit(0);
}

if (format === "gha-deploy") {
  const services = detectDockerServices(changedFiles, workflow);
  const matrix = buildDeployMatrix(services);
  writeGithubOutput({
    any: services.length > 0 ? "true" : "false",
    matrix: JSON.stringify(matrix),
  });
  process.exit(0);
}

writeGithubOutput({
  run_heavy_jobs: result.runCodeQuality ? "true" : "false",
  turbo_scope: result.turboScope,
  turbo_base_sha: result.turboBaseSha,
  turbo_head_sha: result.turboHeadSha,
  run_prisma_drift: result.runPrismaDrift ? "true" : "false",
  run_cursor_review: result.runCursorReview ? "true" : "false",
  run_ai_review: result.runAiReview ? "true" : "false",
  services: JSON.stringify(result.dockerServices),
  any: result.dockerAny ? "true" : "false",
});
