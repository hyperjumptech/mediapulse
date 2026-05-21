import { execFileSync } from "node:child_process";

const PRETTIER_FILE_PATTERN = /\.(ts|tsx|md)$/;

/**
 * Returns whether a path uses a Prettier-supported extension in this repo.
 *
 * @param {string} filePath
 * @returns {boolean}
 */
export const isPrettierEligiblePath = (filePath) =>
  PRETTIER_FILE_PATTERN.test(filePath);

/**
 * Parses newline-separated paths from `git diff --name-only` output.
 *
 * @param {string} stdout
 * @returns {string[]}
 */
export const parseGitDiffNameOnly = (stdout) =>
  stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

/**
 * Keeps only paths that Prettier should check.
 *
 * @param {string[]} paths
 * @returns {string[]}
 */
export const filterPrettierEligiblePaths = (paths) =>
  paths.filter(isPrettierEligiblePath);

/**
 * Lists changed files between two refs that Prettier should validate.
 *
 * @param {{
 *   baseRef: string;
 *   headRef: string;
 *   execFileSync?: typeof execFileSync;
 * }} options
 * @returns {string[]}
 */
export const listChangedPrettierPaths = ({
  baseRef,
  headRef,
  execFileSync: execFile = execFileSync,
}) => {
  const stdout = execFile(
    "git",
    ["diff", "--name-only", "--diff-filter=ACMRTUXB", baseRef, headRef],
    { encoding: "utf8" },
  );

  return filterPrettierEligiblePaths(parseGitDiffNameOnly(stdout));
};

/**
 * Runs Prettier in check mode on the given paths.
 *
 * @param {{
 *   paths: string[];
 *   execFileSync?: typeof execFileSync;
 * }} options
 * @returns {void}
 */
export const runPrettierCheck = ({
  paths,
  execFileSync: execFile = execFileSync,
}) => {
  if (paths.length === 0) {
    return;
  }

  execFile("pnpm", ["exec", "prettier", "--check", ...paths], {
    stdio: "inherit",
  });
};

/**
 * Checks Prettier formatting only on changed eligible files between two refs.
 *
 * @param {{
 *   baseRef: string;
 *   headRef: string;
 *   execFileSync?: typeof execFileSync;
 * }} options
 * @returns {{ paths: string[]; checked: boolean }}
 */
export const runPrettierCheckChanged = (options) => {
  const paths = listChangedPrettierPaths(options);

  if (paths.length === 0) {
    return { paths, checked: false };
  }

  runPrettierCheck({ paths, execFileSync: options.execFileSync });

  return { paths, checked: true };
};
