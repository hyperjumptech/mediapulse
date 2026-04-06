/**
 * @typedef {"error"|"warning"} CursorPrReviewSeverity
 *
 * @typedef {Readonly<{
 *   ruleId:
 *     | "env-variables"
 *     | "typescript-javascript-standards"
 *     | "react-custom-hooks"
 *     | "prisma-strong-typing"
 *     | "prisma-migrations";
 *   severity: CursorPrReviewSeverity;
 *   message: string;
 *   filePath?: string;
 *   line?: number;
 * }>} CursorPrReviewFinding
 *
 * @typedef {Readonly<{ findings: readonly CursorPrReviewFinding[] }>} CursorPrReviewResult
 *
 * @typedef {Readonly<{ status: string; filePath: string }>} GitChangedFile
 *
 * @typedef {Readonly<{
 *   listChangedFiles: (args: { baseRef: string; headRef: string }) => Promise<readonly GitChangedFile[]>;
 *   readTextFile: (filePath: string) => Promise<string>;
 * }>} CursorPrReviewCollaborators
 *
 * @typedef {Readonly<{ baseRef: string; headRef: string }>} CursorPrReviewOptions
 */

const isTsJsLike = (filePath) =>
  /\.(ts|tsx|js|jsx)$/.test(filePath) && !/\.d\.ts$/.test(filePath);

const isTsOrTsx = (filePath) =>
  /\.(ts|tsx)$/.test(filePath) && !/\.d\.ts$/.test(filePath);

const isTsx = (filePath) => /\.tsx$/.test(filePath);

/** Markdown docs are excluded from the kebab-case new-file check (naming varies by tool conventions). */
const isKebabCheckSkippedPath = (filePath) => /\.mdx?$/i.test(filePath);

/** Repo-root `scripts/` only (not e.g. `packages/foo/scripts/`). */
const normalizeRepoPath = (filePath) => filePath.replaceAll("\\", "/");
const isRepoRootScriptsPath = (filePath) => {
  const n = normalizeRepoPath(filePath);
  return n === "scripts" || n.startsWith("scripts/");
};

const isReviewableSourceFile = (filePath) =>
  isTsJsLike(filePath) && !/\.test\.(ts|tsx|js|jsx)$/.test(filePath);

const KEBAB_STEM_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * True when `stem` is empty, a single kebab-case token, or dot-separated kebab-case tokens
 * (e.g. `route.post` before `.config.ts`).
 *
 * @param {string} stem
 * @returns {boolean}
 */
const isKebabStemOrDotJoinedKebab = (stem) =>
  stem.length === 0 ||
  stem.split(".").every((part) => part.length > 0 && KEBAB_STEM_RE.test(part));

/** Basenames that are conventionally not kebab-case filenames. */
const EXEMPT_BASE_NAMES_LOWER = new Set([
  "dockerfile",
  "containerfile",
  "makefile",
  "gemfile",
  "rakefile",
]);

/**
 * Returns the basename stem to validate with {@link isKebabStemOrDotJoinedKebab}, or `null` when exempt.
 * Uses the real basename casing so `BadName.ts` does not become a false negative.
 *
 * @param {string} base
 * @returns {string | null}
 */
const kebabStemOrExempt = (base) => {
  const baseLower = base.toLowerCase();
  if (EXEMPT_BASE_NAMES_LOWER.has(baseLower)) return null;
  if (baseLower === "dockerfile" || baseLower.startsWith("dockerfile."))
    return null;

  // Env example fragments: `env.<pkg-id>.example`
  if (/^env\.[a-z0-9.-]+\.example$/i.test(base)) return null;

  const testMatch = base.match(/^(.+)\.test\.(ts|tsx|js|jsx)$/i);
  if (testMatch?.[1]) return testMatch[1];

  const specMatch = base.match(/^(.+)\.spec\.(ts|tsx|js|jsx)$/i);
  if (specMatch?.[1]) return specMatch[1];

  const configMatch = base.match(/^(.+)\.config\.(ts|tsx|mjs|cjs|js)$/i);
  if (configMatch?.[1]) return configMatch[1];

  return base.replace(/\.[^.]+$/, "");
};

/**
 * @param {string} filePath
 * @returns {boolean}
 */
const isKebabCaseBasename = (filePath) => {
  const base = filePath.split("/").at(-1) ?? "";
  if (base.length === 0) return true;
  if (base.startsWith(".")) return true;

  const stem = kebabStemOrExempt(base);
  if (stem === null) return true;
  return isKebabStemOrDotJoinedKebab(stem);
};

/**
 * 1-based line number of the first match of `re` in `text` (non-global `re` recommended).
 *
 * @param {string} text
 * @param {RegExp} re
 * @returns {number | undefined}
 */
const firstLineOfRegexMatch = (text, re) => {
  const flags = re.flags.replaceAll("g", "");
  const m = new RegExp(re.source, flags).exec(text);
  if (!m || m.index === undefined) return undefined;
  return text.slice(0, m.index).split("\n").length;
};

/**
 * @param {string} text
 * @param {(line: string) => boolean} predicate
 * @returns {number | undefined}
 */
const firstLineWhere = (text, predicate) => {
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (predicate(lines[i] ?? "")) return i + 1;
  }
  return undefined;
};

const CURSOR_PR_REVIEW_DIRECTIVE_MAX_LINES = 40;

/**
 * Reads file-top directives to skip named rule IDs (or all rules) for this file.
 * Scans the first {@link CURSOR_PR_REVIEW_DIRECTIVE_MAX_LINES} lines for:
 * - `// cursor-pr-review-disable: <ids>` (TypeScript/JavaScript)
 * - `/* cursor-pr-review-disable: <ids> *\/` (single-line block)
 * - `-- cursor-pr-review-disable: <ids>` when `filePath` ends with `.sql`
 *
 * Use comma-separated rule ids (e.g. `env-variables`, `typescript-javascript-standards`)
 * or the token `all`. Matching is case-insensitive for the keyword and ids.
 *
 * @param {string} text
 * @param {string} [filePath]
 * @returns {{ all: boolean; rules: ReadonlySet<string> }}
 */
export const parseCursorPrReviewDirectives = (text, filePath = "") => {
  const lines = text.split("\n");
  const allowSqlDash = /\.sql$/i.test(filePath);
  let all = false;
  /** @type {Set<string>} */
  const rules = new Set();
  const limit = Math.min(CURSOR_PR_REVIEW_DIRECTIVE_MAX_LINES, lines.length);

  for (let i = 0; i < limit; i++) {
    const raw = lines[i] ?? "";
    const trimmed = raw.trim();
    if (i === 0 && trimmed.startsWith("#!")) continue;

    const slashSlash = trimmed.match(
      /^\/\/\s*cursor-pr-review-disable:\s*(.+)$/i,
    );
    const block = trimmed.match(
      /^\/\*\s*cursor-pr-review-disable:\s*([^*]+?)\s*\*\/\s*$/i,
    );
    const sqlDash =
      allowSqlDash && trimmed.match(/^--\s*cursor-pr-review-disable:\s*(.+)$/i);

    const payload = slashSlash?.[1] ?? block?.[1] ?? sqlDash?.[1];
    if (!payload) continue;

    for (const part of payload.split(",")) {
      const token = part.trim().toLowerCase();
      if (token === "all") all = true;
      else if (token.length > 0) rules.add(token);
    }
  }

  return { all, rules };
};

/**
 * @param {string} text
 * @param {CursorPrReviewFinding["ruleId"]} ruleId
 * @param {string} [filePath]
 * @returns {boolean}
 */
const isRuleDisabledInFile = (text, ruleId, filePath = "") => {
  const { all, rules } = parseCursorPrReviewDirectives(text, filePath);
  if (all) return true;
  return rules.has(ruleId);
};

/**
 * Parses `git diff --name-status` output, including rename/copy rows (`R100\told\tnew`).
 *
 * @param {string} stdout
 * @returns {readonly GitChangedFile[]}
 */
export const parseGitDiffNameStatus = (stdout) => {
  /** @type {GitChangedFile[]} */
  const out = [];
  for (const rawLine of stdout.split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    const parts = line.split("\t").filter((p) => p.length > 0);
    const status = parts[0] ?? "";
    if (status.length === 0) continue;

    if (
      (status.startsWith("R") || status.startsWith("C")) &&
      parts.length >= 3
    ) {
      out.push({ status, filePath: parts[2] });
      continue;
    }

    if (parts.length >= 2) {
      out.push({ status, filePath: parts[1] });
    }
  }
  return out;
};

/**
 * @param {readonly string[]} lines
 * @param {number} exportLineIdx
 * @returns {boolean}
 */
const hasPrecedingJsDocBlock = (lines, exportLineIdx) => {
  let j = exportLineIdx - 1;
  while (j >= 0 && /^\s*$/.test(lines[j] ?? "")) j--;
  while (j >= 0 && /^\s*\/\//.test(lines[j] ?? "")) j--;
  if (j < 0) return false;
  if (!/\*\/\s*$/.test(lines[j] ?? "")) return false;
  while (j >= 0) {
    if (/\/\*\*/.test(lines[j] ?? "")) return true;
    j--;
  }
  return false;
};

/**
 * @param {string} text
 * @param {string} filePath
 * @returns {readonly CursorPrReviewFinding[]}
 */
const collectMissingJsDocFindingsForExports = (text, filePath) => {
  const lines = text.split("\n");
  /** @type {CursorPrReviewFinding[]} */
  const out = [];

  const exportLinePatterns = [
    /^\s*export\s+(async\s+)?function\s+/,
    /^\s*export\s+default\s+(async\s+)?function\s+/,
    /^\s*export\s+const\s+\w+\s*=\s*(async\s*)?\(/,
  ];

  lines.forEach((line, idx) => {
    const matchesExport = exportLinePatterns.some((re) => re.test(line));
    if (!matchesExport) return;
    if (hasPrecedingJsDocBlock(lines, idx)) return;
    out.push({
      ruleId: "typescript-javascript-standards",
      severity: "warning",
      filePath,
      line: idx + 1,
      message:
        "Exported functions should have a preceding JSDoc block (typescript-javascript-standards).",
    });
  });

  return out;
};

/**
 * @param {string} filePath
 * @param {readonly GitChangedFile[]} changed
 * @param {string} text
 * @returns {readonly CursorPrReviewFinding[]}
 */
const collectMissingCoLocatedTestFindings = (filePath, changed, text) => {
  if (!/\bexport\b/.test(text)) return [];

  const stem = filePath.replace(/\.(ts|tsx)$/, "");
  const coLocated = [
    `${stem}.test.ts`,
    `${stem}.test.tsx`,
    `${stem}.spec.ts`,
    `${stem}.spec.tsx`,
  ];

  const hasTest = changed.some(
    (f) =>
      f.status !== "D" &&
      coLocated.some((candidate) => f.filePath === candidate),
  );

  if (hasTest) return [];

  const exportLine = firstLineWhere(text, (line) => /\bexport\b/.test(line));

  return [
    {
      ruleId: "typescript-javascript-standards",
      severity: "warning",
      filePath,
      ...(exportLine !== undefined ? { line: exportLine } : {}),
      message:
        "New module exports but has no co-located *.test.ts / *.test.tsx next to it (typescript-javascript-standards).",
    },
  ];
};

/**
 * Runs deterministic checks over the PR diff to enforce a subset of `.cursor/rules`.
 * This is intentionally heuristic and diff-scoped; the hard correctness gate remains `pnpm code-quality`.
 *
 * @param {CursorPrReviewCollaborators} collaborators
 * @param {CursorPrReviewOptions} options
 * @returns {Promise<CursorPrReviewResult>}
 */
export const runCursorPrReview = async (collaborators, options) => {
  const changed = await collaborators.listChangedFiles({
    baseRef: options.baseRef,
    headRef: options.headRef,
  });

  /** @type {CursorPrReviewFinding[]} */
  const findings = [];

  // typescript-javascript-standards: kebab-case for new files
  for (const f of changed) {
    if (f.status !== "A") continue;
    if (isKebabCheckSkippedPath(f.filePath)) continue;
    const kebabText = await collaborators.readTextFile(f.filePath);
    if (
      isRuleDisabledInFile(
        kebabText,
        "typescript-javascript-standards",
        f.filePath,
      )
    )
      continue;
    if (!isKebabCaseBasename(f.filePath)) {
      findings.push({
        ruleId: "typescript-javascript-standards",
        severity: "error",
        filePath: f.filePath,
        message: "New file name must be kebab-case.",
      });
    }
  }

  // env-variables: never use process.env directly (repo app/packages code; not repo-root scripts/)
  for (const f of changed) {
    if (f.status === "D") continue;
    if (!isTsJsLike(f.filePath)) continue;
    if (isRepoRootScriptsPath(f.filePath)) continue;
    const text = await collaborators.readTextFile(f.filePath);
    if (isRuleDisabledInFile(text, "env-variables", f.filePath)) continue;
    if (/\bprocess\.env\b/.test(text)) {
      const line = firstLineOfRegexMatch(text, /\bprocess\.env\b/);
      findings.push({
        ruleId: "env-variables",
        severity: "error",
        filePath: f.filePath,
        ...(line !== undefined ? { line } : {}),
        message:
          "Do not use process.env directly; use @hermes/env or @mediapulse/env.",
      });
    }
  }

  // typescript-javascript-standards: JSDoc + co-located tests (heuristic)
  for (const f of changed) {
    if (f.status === "D") continue;
    if (!isReviewableSourceFile(f.filePath)) continue;

    const text = await collaborators.readTextFile(f.filePath);
    if (
      isRuleDisabledInFile(text, "typescript-javascript-standards", f.filePath)
    )
      continue;

    if (f.status === "A") {
      findings.push(...collectMissingJsDocFindingsForExports(text, f.filePath));
    }

    if (
      f.status === "A" &&
      isTsOrTsx(f.filePath) &&
      !/\.test\.(ts|tsx)$/.test(f.filePath)
    ) {
      findings.push(
        ...collectMissingCoLocatedTestFindings(f.filePath, changed, text),
      );
    }
  }

  // react-custom-hooks: forbid direct useState/useEffect in TSX files (heuristic)
  for (const f of changed) {
    if (f.status === "D") continue;
    if (!isTsx(f.filePath)) continue;
    const text = await collaborators.readTextFile(f.filePath);
    if (isRuleDisabledInFile(text, "react-custom-hooks", f.filePath)) continue;
    if (/\buseState\s*\(/.test(text) || /\buseEffect\s*\(/.test(text)) {
      const line = firstLineWhere(
        text,
        (ln) => /\buseState\s*\(/.test(ln) || /\buseEffect\s*\(/.test(ln),
      );
      findings.push({
        ruleId: "react-custom-hooks",
        severity: "error",
        filePath: f.filePath,
        ...(line !== undefined ? { line } : {}),
        message:
          "React components must not use useState/useEffect directly; move state/effects into custom hooks.",
      });
    }
  }

  // prisma-migrations: if schema.prisma changed, avoid editing existing migration.sql (heuristic)
  const schemaPrismaTouched = changed.some(
    (f) => f.status !== "D" && /schema\.prisma$/.test(f.filePath),
  );
  if (schemaPrismaTouched) {
    const editedMigrationSql = changed.filter((f) => {
      if (!/\/migrations\/.+\/migration\.sql$/.test(f.filePath)) return false;
      const isAdded =
        f.status === "A" ||
        f.status === "AM" ||
        (f.status.length > 0 && f.status[0] === "A");
      return !isAdded && f.status !== "D";
    });
    for (const f of editedMigrationSql) {
      const migText = await collaborators.readTextFile(f.filePath);
      if (isRuleDisabledInFile(migText, "prisma-migrations", f.filePath))
        continue;
      findings.push({
        ruleId: "prisma-migrations",
        severity: "error",
        filePath: f.filePath,
        message:
          "Do not hand-edit an existing migration.sql when the Prisma schema changes; prefer a new migration via db:migrate:dev.",
      });
    }
  }

  // prisma-strong-typing: catch obvious anti-patterns in Prisma-related files (heuristic)
  for (const f of changed) {
    if (f.status === "D") continue;
    if (!/\.ts$/.test(f.filePath) && !/\.tsx$/.test(f.filePath)) continue;
    const text = await collaborators.readTextFile(f.filePath);
    if (isRuleDisabledInFile(text, "prisma-strong-typing", f.filePath))
      continue;
    const looksLikePrisma = /\bPrisma\b/.test(text) || /\bprisma\./.test(text);
    if (!looksLikePrisma) continue;

    const prismaInlineRe =
      /\bprisma\.\w+\.(findMany|findFirst|findUnique|createMany|create|updateMany|update|deleteMany|delete|upsert|count|aggregate|groupBy)\s*\(\s*\{/;
    if (prismaInlineRe.test(text)) {
      const line = firstLineOfRegexMatch(text, prismaInlineRe);
      findings.push({
        ruleId: "prisma-strong-typing",
        severity: "warning",
        filePath: f.filePath,
        ...(line !== undefined ? { line } : {}),
        message:
          "Prefer extracting Prisma query args into a variable typed with `satisfies Prisma.*Args` instead of inline `{ ... }` objects in delegate calls.",
      });
    }

    if (/\bas unknown as\b/.test(text)) {
      const line = firstLineOfRegexMatch(text, /\bas unknown as\b/);
      findings.push({
        ruleId: "prisma-strong-typing",
        severity: "warning",
        filePath: f.filePath,
        ...(line !== undefined ? { line } : {}),
        message:
          "Avoid broad `as unknown as` casts around Prisma types; prefer generated Prisma helpers and `satisfies`.",
      });
    }
    if (/\b:\s*any\b/.test(text)) {
      const line = firstLineOfRegexMatch(text, /\b:\s*any\b/);
      findings.push({
        ruleId: "prisma-strong-typing",
        severity: "warning",
        filePath: f.filePath,
        ...(line !== undefined ? { line } : {}),
        message:
          "Avoid `any` in Prisma-related code; use generated Prisma args/payload helpers and typed delegates.",
      });
    }
  }

  return { findings };
};
