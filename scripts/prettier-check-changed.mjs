import { execFileSync } from "node:child_process";
import process from "node:process";

import { runPrettierCheckChanged } from "./lib/prettier-check-changed.mjs";

/**
 * Reads a CLI flag value or returns the default when missing.
 *
 * @param {string} name
 * @param {string} defaultValue
 * @returns {string}
 */
const getArgValue = (name, defaultValue) => {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) {
    return defaultValue;
  }

  const value = process.argv[idx + 1];
  if (!value || value.startsWith("--")) {
    return defaultValue;
  }

  return value;
};

/**
 * Resolves the default git base ref for local runs.
 *
 * @returns {string}
 */
const getDefaultBaseRef = () => {
  try {
    execFileSync("git", ["rev-parse", "--verify", "origin/main"], {
      stdio: "ignore",
    });
    return "origin/main";
  } catch {
    return "main";
  }
};

const baseRef = getArgValue("base", getDefaultBaseRef());
const headRef = getArgValue("head", "HEAD");

const result = runPrettierCheckChanged({ baseRef, headRef });

if (!result.checked) {
  // eslint-disable-next-line no-console
  console.log("prettier-check-changed: no eligible changed files");
}
