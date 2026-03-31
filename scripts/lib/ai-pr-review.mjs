/**
 * @typedef {Readonly<{ relPath: string; content: string }>} CursorContextChunk
 */

const REPO_RULES_GLOB_HINT = ".cursor/rules";
const SKILLS_DIR = ".cursor/skills";

/** Max total characters of rule/skill text embedded in the prompt (excluding diff). */
const DEFAULT_MAX_CONTEXT_CHARS = 120_000;

/**
 * When both rules and skills are present, reserve this fraction of {@link DEFAULT_MAX_CONTEXT_CHARS}
 * for skills so path-selected skills are not dropped after rules fill the budget.
 */
const DEFAULT_SKILL_CONTEXT_RESERVE_RATIO = 0.38;

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
    haystack.includes("apps/") ||
    haystack.includes("packages/") ||
    haystack.includes("apps\\") ||
    haystack.includes("packages\\")
  ) {
    skills.add(`${SKILLS_DIR}/organized-src-structure/SKILL.md`);
  }

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

  if (
    /\bdataqueue\b/i.test(haystack) ||
    haystack.includes("@nicnocquee/dataqueue")
  ) {
    skills.add(`${SKILLS_DIR}/dataqueue-core/SKILL.md`);
    skills.add(`${SKILLS_DIR}/dataqueue-advanced/SKILL.md`);
  }

  if (
    haystack.includes("dataqueue-react") ||
    haystack.includes("useJob") ||
    /DataqueueProvider/i.test(haystack)
  ) {
    skills.add(`${SKILLS_DIR}/dataqueue-react/SKILL.md`);
  }

  if (
    haystack.includes("dev-docs/") ||
    haystack.includes("speed-docs") ||
    haystack.includes(".mdx")
  ) {
    skills.add(`${SKILLS_DIR}/create-project-docs/SKILL.md`);
  }

  if (haystack.includes("mermaid") || haystack.includes(".mmd")) {
    skills.add(`${SKILLS_DIR}/mermaid-diagram/SKILL.md`);
  }

  const touchesRepoSource =
    haystack.includes("apps/") ||
    haystack.includes("packages/") ||
    haystack.includes("apps\\") ||
    haystack.includes("packages\\");

  if (touchesRepoSource && /\.(tsx?|mts|cts)(\\|\/|\s|$)/i.test(haystack)) {
    skills.add(`${SKILLS_DIR}/vitest-unit-testing/SKILL.md`);
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
 * Truncates rules and skills to a shared character budget while reserving a slice
 * for skills whenever skills are present (avoids losing all skill text after rules).
 *
 * @param {readonly CursorContextChunk[]} ruleChunks
 * @param {readonly CursorContextChunk[]} skillChunks
 * @param {number} maxChars
 * @param {number} [skillReserveRatio]
 * @returns {readonly CursorContextChunk[]}
 */
export const truncateRulesAndSkillsChunks = (
  ruleChunks,
  skillChunks,
  maxChars,
  skillReserveRatio = DEFAULT_SKILL_CONTEXT_RESERVE_RATIO,
) => {
  if (skillChunks.length === 0) {
    return truncateContextChunks(ruleChunks, maxChars);
  }
  if (ruleChunks.length === 0) {
    return truncateContextChunks(skillChunks, maxChars);
  }
  const ratio = Math.min(0.45, Math.max(0.2, skillReserveRatio));
  const skillBudget = Math.floor(maxChars * ratio);
  const ruleBudget = Math.max(0, maxChars - skillBudget);
  return [
    ...truncateContextChunks(ruleChunks, ruleBudget),
    ...truncateContextChunks(skillChunks, skillBudget),
  ];
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
 *   skillContextReserveRatio?: number;
 * }>} args
 * @returns {string}
 */
export const buildAiReviewPrompt = (args) => {
  const maxContext = args.maxContextChars ?? DEFAULT_MAX_CONTEXT_CHARS;
  const merged = truncateRulesAndSkillsChunks(
    args.ruleChunks,
    args.skillChunks,
    maxContext,
    args.skillContextReserveRatio ?? DEFAULT_SKILL_CONTEXT_RESERVE_RATIO,
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
You are a senior reviewer for a TypeScript monorepo. Internally check the PR diff against **Context: rules** and **Context: skills** below. **Output must be minimal:** do not invent problems, generic advice, or “educational” follow-ups. If the diff does not violate the pasted standards in a concrete way, say so briefly and stop—leave optional sections out entirely.

Return **GitHub-flavored markdown** using **only** the sections below, in order. **Omit a section completely** (no heading, no placeholder text) when you have nothing real to put there.

## Summary
- If there are **no** substantive findings: **one or two factual sentences only** (e.g. that nothing in the diff conflicts with the supplied rules/skills). No bullet list, no table, no restating the whole PR.
- If there **are** findings: 1–3 short bullets **tied to those findings only**. No tables here.

## Findings
Include this section **only if** there is at least **one** substantive, evidence-backed row. If none, **omit this entire section** (do not output an empty table, no placeholder row, no “no findings” row).

When present, output **only** a single markdown table under this heading—no extra prose. Use **exactly** these five columns and header row **verbatim** (including capitalization):

| Tier | Rule | File | Line | Finding |
| :--- | :--- | :--- | :--- | :--- |

**Row rules (fixed layout):**
- **Tier** must be exactly one of: \`must-fix\` | \`should-fix\` | \`nice-to-have\`.
- **Rule** is a short id (e.g. \`env-variables\`, \`prisma-strong-typing\`, or the rule filename like \`typescript-javascript-standards.mdc\`).
- **File** is a repo-relative path from the diff, or \`—\` if not file-specific.
- **Line** is a single line number, or \`—\` if unknown or N/A.
- **Finding** is plain text in a single table cell: **one or two short sentences**, no pipe characters, no newlines. Be specific (what to change and why).

## Possible false positives
Include **only if** you already listed at least one finding **and** there is **specific** doubt about that finding (name the file/rule). Otherwise **omit this section entirely**—no empty table, no “—” placeholders, no generic caveats.

## Suggested follow-ups
Include **only if** there is a **concrete**, diff- or rules-grounded action **not** already covered by a Finding row (e.g. a named follow-up ticket tied to a gap you cited). Otherwise **omit this section entirely**. **Forbidden:** generic team advice (“ensure contributors know…”, “monitor effectiveness…”, “consider documenting…”) that does not reference a specific rule line and diff hunk.

### Reviewer discipline (follow strictly)
- Every Finding row must be grounded in **quoted or paraphrased** rule/skill text **or** a clear diff issue. If you cannot tie it that way, **do not output a Finding** for it.
- **No hollow praise** and no PR recap unless it directly supports a finding.
- **Test location (this monorepo)**: Default expectation is \`*.test.ts\` / \`*.test.tsx\` **next to the module under test**. A top-level \`tests/\` tree separate from \`src/\` is not the default—flag only when the diff actually adds such a mismatch per neighboring patterns.
- **Nice-to-have** rows: only when a real, minor improvement is rules-grounded; no filler.
- **Prisma migrations**: A **new** \`prisma/migrations/<timestamp>_<name>/migration.sql\` in the diff is usually compliant. Do **not** flag it as a violation without evidence it was hand-edited against policy; default to **no row**.

Be specific when you do cite issues: rule name, file path, and why.

### Context: rules (${REPO_RULES_GLOB_HINT})
${rules.length > 0 ? rules : "(no rule files provided)"}

### Context: skills (${SKILLS_DIR})
${skills.length > 0 ? skills : "(no skill files selected)"}

### PR diff
${diff}
`.trim();
};
