/**
 * @typedef {Readonly<{ relPath: string; content: string }>} CursorContextChunk
 */

const REPO_RULES_GLOB_HINT = ".cursor/rules";
const SKILLS_DIR = ".cursor/skills";

/** Max total characters of rule/skill text embedded in the prompt (excluding diff). */
const DEFAULT_MAX_CONTEXT_CHARS = 120_000;

/** @param {string} relPath */
const normalizeRelPath = (relPath) => relPath.replaceAll("\\", "/");

/**
 * Selects relevant skill markdown files based on changed paths (best-effort).
 *
 * @param {readonly string[]} changedRelPaths
 * @returns {readonly string[]}
 */
export const selectSkillRelativePaths = (changedRelPaths) => {
  const haystack = changedRelPaths.map(normalizeRelPath).join("\n");
  /** @type {Set<string>} */
  const skills = new Set();

  if (
    haystack.includes("schema.prisma") ||
    haystack.includes("/prisma/") ||
    haystack.includes("\\prisma\\")
  ) {
    skills.add(`${SKILLS_DIR}/prisma-strong-typing/SKILL.md`);
    skills.add(`${SKILLS_DIR}/prisma-migrate-dev/SKILL.md`);
  }

  if (haystack.includes(".tsx")) {
    skills.add(`${SKILLS_DIR}/react-component/SKILL.md`);
  }

  if (
    haystack.includes(".test.ts") ||
    haystack.includes(".test.tsx") ||
    haystack.includes(".spec.ts") ||
    haystack.includes(".spec.tsx")
  ) {
    skills.add(`${SKILLS_DIR}/vitest-unit-testing/SKILL.md`);
  }

  if (
    haystack.includes("agent-data-api") ||
    haystack.includes("agent-data-api-contract")
  ) {
    skills.add(`${SKILLS_DIR}/agent-data-api-endpoints/SKILL.md`);
  }

  if (haystack.includes("env.example") || haystack.includes("/env/")) {
    skills.add(`${SKILLS_DIR}/env-variables/SKILL.md`);
  }

  if (
    haystack.includes("email-templates") ||
    haystack.includes("react-email")
  ) {
    skills.add(`${SKILLS_DIR}/email-template/SKILL.md`);
  }

  return [...skills].sort((a, b) => a.localeCompare(b));
};

/**
 * Truncates long text by keeping the start and end, for token safety.
 *
 * @param {string} text
 * @param {number} maxLen
 * @returns {string}
 */
export const truncateMiddle = (text, maxLen) => {
  if (text.length <= maxLen) return text;
  const marker = "\n\n…[truncated]…\n\n";
  if (maxLen <= marker.length + 2) {
    return `${text.slice(0, Math.max(0, maxLen - 1))}…`;
  }
  const budget = maxLen - marker.length;
  const headChars = Math.max(1, Math.floor(budget / 2));
  const tailChars = Math.max(1, budget - headChars);
  return `${text.slice(0, headChars)}${marker}${text.slice(text.length - tailChars)}`;
};

/**
 * Truncates a list of context chunks to a maximum total character budget.
 *
 * @param {readonly CursorContextChunk[]} chunks
 * @param {number} maxChars
 * @returns {readonly CursorContextChunk[]}
 */
export const truncateContextChunks = (chunks, maxChars) => {
  let used = 0;
  /** @type {CursorContextChunk[]} */
  const out = [];

  for (const chunk of chunks) {
    const remaining = maxChars - used;
    if (remaining <= 0) break;

    if (chunk.content.length <= remaining) {
      out.push(chunk);
      used += chunk.content.length;
      continue;
    }

    out.push({
      relPath: chunk.relPath,
      content: `${chunk.content.slice(0, remaining)}\n\n...[truncated]`,
    });
    used += remaining;
    break;
  }

  return out;
};

/**
 * Builds the markdown prompt sent to the LLM.
 *
 * @param {Readonly<{
 *   diffText: string;
 *   maxDiffChars: number;
 *   ruleChunks: readonly CursorContextChunk[];
 *   skillChunks: readonly CursorContextChunk[];
 *   maxContextChars?: number;
 * }>} args
 * @returns {string}
 */
export const buildAiReviewPrompt = (args) => {
  const maxContext = args.maxContextChars ?? DEFAULT_MAX_CONTEXT_CHARS;
  const merged = truncateContextChunks(
    [...args.ruleChunks, ...args.skillChunks],
    maxContext,
  );

  const rules = merged
    .filter((c) => c.relPath.startsWith(`${REPO_RULES_GLOB_HINT}/`))
    .map((c) => `### ${c.relPath}\n${c.content}`)
    .join("\n\n");

  const skills = merged
    .filter((c) => c.relPath.startsWith(`${SKILLS_DIR}/`))
    .map((c) => `### ${c.relPath}\n${c.content}`)
    .join("\n\n");

  const diff = truncateMiddle(args.diffText, args.maxDiffChars);

  return `
You are a senior reviewer for a TypeScript monorepo. Compare the PR diff with the provided Cursor rules and skills.

Return **GitHub-flavored markdown** with exactly these sections (keep headings):
## Summary
## Must-fix (rule violations)
## Should-fix
## Nice-to-have
## Possible false positives
## Suggested follow-ups

Be specific: cite rule names and file paths. If you are guessing, say so under Possible false positives.

### Context: rules (${REPO_RULES_GLOB_HINT})
${rules.length > 0 ? rules : "(no rule files provided)"}

### Context: skills (${SKILLS_DIR})
${skills.length > 0 ? skills : "(no skill files selected)"}

### PR diff
${diff}
`.trim();
};
