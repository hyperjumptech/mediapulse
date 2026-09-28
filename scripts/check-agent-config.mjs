import { access, readdir, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { checkAgentConfig } from "./lib/check-agent-config.mjs";

const repoRoot = process.cwd();

const resolveRealPath = async (relativePath) => {
  try {
    return await realpath(path.join(repoRoot, relativePath));
  } catch {
    return null;
  }
};

const listDirectory = async (relativePath) => {
  const entries = await readdir(path.join(repoRoot, relativePath), {
    withFileTypes: true,
  });

  return entries
    .filter((entry) => !entry.name.startsWith("."))
    .map((entry) => entry.name)
    .sort();
};

const readTextFile = (relativePath) =>
  readFile(path.join(repoRoot, relativePath), "utf8");

const fileExists = async (relativePath) => {
  try {
    await access(path.join(repoRoot, relativePath));

    return true;
  } catch {
    return false;
  }
};

const findings = await checkAgentConfig({
  resolveRealPath,
  listDirectory,
  readTextFile,
  fileExists,
});

if (findings.length > 0) {
  for (const finding of findings) {
    console.error(`${finding.filePath}: ${finding.message}`);
  }
  process.exit(1);
}

console.log("Agent config OK: skills, rules and agents resolve.");
