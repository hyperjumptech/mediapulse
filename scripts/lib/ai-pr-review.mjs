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
You are a senior reviewer for a TypeScript monorepo. **Systematically** compare the PR diff with every item under **Context: rules** and **Context: skills** below: when a rule or skill could apply to the changed files or patterns in the diff, check for violations or gaps and record them in **Findings** (do not skip applicable standards just to keep the review short).

Return **GitHub-flavored markdown** with exactly these sections and **in this order**:

## Summary
- 1–5 short bullets or one short paragraph. No tables here.

## Findings
Output **only** a single markdown table (no extra prose under this heading). Use **exactly** these five columns and header row **verbatim** (including capitalization):

| Tier | Rule | File | Line | Finding |
| :--- | :--- | :--- | :--- | :--- |

**Row rules (fixed layout):**
- **Tier** must be exactly one of: \`must-fix\` | \`should-fix\` | \`nice-to-have\`.
- **Rule** is a short id (e.g. \`env-variables\`, \`prisma-strong-typing\`, or the rule filename like \`typescript-javascript-standards.mdc\`).
- **File** is a repo-relative path from the diff, or \`—\` if not file-specific.
- **Line** is a single line number, or \`—\` if unknown or N/A.
- **Finding** is plain text in a single table cell: **one or two short sentences**, no pipe characters, no newlines. Be specific (what to change and why); avoid vague one-word cells.
- Order rows: all \`must-fix\` first, then \`should-fix\`, then \`nice-to-have\`.
- If there are **no** substantive findings after the pass above, output the header row plus one data row: \`nice-to-have\` | \`—\` | \`—\` | \`—\` | No substantive findings tied to the provided rules/skills and diff.

## Possible false positives
Bullet list or a second table with columns: **Note** | **Detail** (same width style preferred). Use \`—\` when needed.

## Suggested follow-ups
Bullet list only (no required table).

### Reviewer discipline (follow strictly)
- Ground every finding in **quoted or paraphrased text** from the rules/skills above, or in an obvious issue in the diff. Do not invent requirements that are not in the provided context. Put genuine uncertainty under **Possible false positives** instead of omitting a suspected issue entirely when the diff is ambiguous.
- **No hollow praise**: do not say "good job", "clean layout", or "nicely co-located" unless the **organized-src-structure** skill / rule clearly applies and the paths match it.
- **Test location (this monorepo)**: Default expectation is \`*.test.ts\` / \`*.test.tsx\` **next to the module under test** (same directory or same feature folder as the source). A top-level \`tests/\` tree **separate from** \`src/\` is **not** the default co-location pattern—call that out under **Should-fix** or **Must-fix** when new agent/package code lives under \`src/\` but tests only live under \`tests/\`, unless the diff shows that **neighboring packages in the same area** already use that \`tests/\` pattern.
- **Nice-to-have** rows belong in the **Findings** table with Tier \`nice-to-have\`. If nothing qualifies, omit those rows (do not add filler praise).
- **Prisma migrations**: A **new** \`prisma/migrations/<timestamp>_<name>/migration.sql\` in the diff is usually **compliant**—that is what \`pnpm db:migrate:dev\` / \`prisma migrate dev\` produces and what you **commit**. The prisma-migrations rule forbids **hand-authoring** or **hand-editing** migration SQL **instead of** that workflow—not the presence of generated SQL in the PR. Do **not** call that a violation unless you have evidence the SQL was not produced by Prisma (you rarely can; default to **no finding**).
- **Possible false positives**: List heuristics or uncertainty here—not in other sections.

Be specific: cite rule/skill file names and paths. If you are guessing, say so under Possible false positives.

### Context: rules (${REPO_RULES_GLOB_HINT})
${rules.length > 0 ? rules : "(no rule files provided)"}

### Context: skills (${SKILLS_DIR})
${skills.length > 0 ? skills : "(no skill files selected)"}

### PR diff
${diff}
`.trim();
};
