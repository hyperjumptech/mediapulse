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

const isReviewableSourceFile = (filePath) =>
  isTsJsLike(filePath) && !/\.test\.(ts|tsx|js|jsx)$/.test(filePath);

const isKebabCaseBasename = (filePath) => {
  const base = filePath.split("/").at(-1) ?? "";
  if (base.length === 0) return true;
  if (base.startsWith(".")) return true;
  const stem = base.replace(/\.[^.]+$/, "");
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(stem);
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

  return [
    {
      ruleId: "typescript-javascript-standards",
      severity: "warning",
      filePath,
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
    if (!isKebabCaseBasename(f.filePath)) {
      findings.push({
        ruleId: "typescript-javascript-standards",
        severity: "error",
        filePath: f.filePath,
        message: "New file name must be kebab-case.",
      });
    }
  }

  // env-variables: never use process.env directly
  for (const f of changed) {
    if (f.status === "D") continue;
    if (!isTsJsLike(f.filePath)) continue;
    const text = await collaborators.readTextFile(f.filePath);
    if (/\bprocess\.env\b/.test(text)) {
      findings.push({
        ruleId: "env-variables",
        severity: "error",
        filePath: f.filePath,
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
    if (/\buseState\s*\(/.test(text) || /\buseEffect\s*\(/.test(text)) {
      findings.push({
        ruleId: "react-custom-hooks",
        severity: "error",
        filePath: f.filePath,
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
    const looksLikePrisma = /\bPrisma\b/.test(text) || /\bprisma\./.test(text);
    if (!looksLikePrisma) continue;

    if (
      /\bprisma\.\w+\.(findMany|findFirst|findUnique|createMany|create|updateMany|update|deleteMany|delete|upsert|count|aggregate|groupBy)\s*\(\s*\{/.test(
        text,
      )
    ) {
      findings.push({
        ruleId: "prisma-strong-typing",
        severity: "warning",
        filePath: f.filePath,
        message:
          "Prefer extracting Prisma query args into a variable typed with `satisfies Prisma.*Args` instead of inline `{ ... }` objects in delegate calls.",
      });
    }

    if (/\bas unknown as\b/.test(text)) {
      findings.push({
        ruleId: "prisma-strong-typing",
        severity: "warning",
        filePath: f.filePath,
        message:
          "Avoid broad `as unknown as` casts around Prisma types; prefer generated Prisma helpers and `satisfies`.",
      });
    }
    if (/\b:\s*any\b/.test(text)) {
      findings.push({
        ruleId: "prisma-strong-typing",
        severity: "warning",
        filePath: f.filePath,
        message:
          "Avoid `any` in Prisma-related code; use generated Prisma args/payload helpers and typed delegates.",
      });
    }
  }

  return { findings };
};
