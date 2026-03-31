import { describe, expect, it } from "vitest";

import {
  parseGitDiffNameStatus,
  runCursorPrReview,
} from "./cursor-pr-review.mjs";

describe("parseGitDiffNameStatus", () => {
  it("parses add/modify/delete rows", () => {
    // Act
    const rows = parseGitDiffNameStatus(
      "A\tapps/a.ts\nM\tapps/b.ts\nD\tapps/c.ts",
    );

    // Assert
    expect(rows).toEqual([
      { status: "A", filePath: "apps/a.ts" },
      { status: "M", filePath: "apps/b.ts" },
      { status: "D", filePath: "apps/c.ts" },
    ]);
  });

  it("parses rename rows using the destination path", () => {
    // Act
    const rows = parseGitDiffNameStatus(
      "R086\tapps/old-name.ts\tapps/new-name.ts",
    );

    // Assert
    expect(rows).toEqual([{ status: "R086", filePath: "apps/new-name.ts" }]);
  });
});

describe("runCursorPrReview", () => {
  it("returns no findings when there are no changes", async () => {
    // Setup
    const listChangedFiles = async () => [];
    const readTextFile = async () => "";

    // Act
    const result = await runCursorPrReview(
      { listChangedFiles, readTextFile },
      { baseRef: "origin/main", headRef: "HEAD" },
    );

    // Assert
    expect(result.findings).toEqual([]);
  });

  it("flags non-kebab-case new file names", async () => {
    // Setup
    const listChangedFiles = async () => [
      { status: "A", filePath: "scripts/lib/BadName.ts" },
    ];
    const readTextFile = async () => "";

    // Act
    const result = await runCursorPrReview(
      { listChangedFiles, readTextFile },
      { baseRef: "origin/main", headRef: "HEAD" },
    );

    // Assert
    expect(result.findings).toEqual([
      expect.objectContaining({
        ruleId: "typescript-javascript-standards",
        severity: "error",
        filePath: "scripts/lib/BadName.ts",
      }),
    ]);
  });

  it("allows dotfiles and kebab-case stems for new files", async () => {
    // Setup
    const listChangedFiles = async () => [
      { status: "A", filePath: ".github/workflows/code-quality.yml" },
      { status: "A", filePath: "scripts/lib/cursor-pr-review.mjs" },
    ];
    const readTextFile = async () => "";

    // Act
    const result = await runCursorPrReview(
      { listChangedFiles, readTextFile },
      { baseRef: "origin/main", headRef: "HEAD" },
    );

    // Assert
    expect(result.findings).toEqual([]);
  });

  it("does not enforce kebab-case for new Markdown files (.md / .mdx)", async () => {
    // Setup
    const listChangedFiles = async () => [
      { status: "A", filePath: ".github/pull_request_template.md" },
      { status: "A", filePath: "dev-docs/docs/SomeTopic.mdx" },
    ];
    const readTextFile = async () => "";

    // Act
    const result = await runCursorPrReview(
      { listChangedFiles, readTextFile },
      { baseRef: "origin/main", headRef: "HEAD" },
    );

    // Assert
    const kebabErrors = result.findings.filter(
      (f) =>
        f.ruleId === "typescript-javascript-standards" &&
        f.message.includes("kebab-case"),
    );
    expect(kebabErrors).toEqual([]);
  });

  it("allows conventional filenames that are not kebab-case (Dockerfile, *.test.ts, *.config.ts, env.*.example)", async () => {
    // Setup
    const listChangedFiles = async () => [
      {
        status: "A",
        filePath: "apps/mediapulse/agents/query-analysis/Dockerfile",
      },
      {
        status: "A",
        filePath: "apps/mediapulse/agents/query-analysis/tests/index.test.ts",
      },
      {
        status: "A",
        filePath: "apps/mediapulse/agents/query-analysis/vitest.config.ts",
      },
      {
        status: "A",
        filePath: "packages/mediapulse/env/env.agents.query-analysis.example",
      },
    ];
    const readTextFile = async () => "// placeholder: no exports";

    // Act
    const result = await runCursorPrReview(
      { listChangedFiles, readTextFile },
      { baseRef: "origin/main", headRef: "HEAD" },
    );

    // Assert
    const kebabErrors = result.findings.filter(
      (f) =>
        f.ruleId === "typescript-javascript-standards" &&
        f.message.includes("kebab-case"),
    );
    expect(kebabErrors).toEqual([]);
  });

  it("flags process.env usage in changed TS/JS-like files", async () => {
    // Setup
    const listChangedFiles = async () => [
      { status: "M", filePath: "apps/x/src/foo.ts" },
      { status: "M", filePath: "apps/x/src/bar.tsx" },
      { status: "M", filePath: "apps/x/src/baz.js" },
      { status: "M", filePath: "apps/x/src/skip.d.ts" },
    ];
    const readTextFile = async (filePath: string) =>
      filePath.endsWith(".d.ts")
        ? "declare const x: string;"
        : "const line1 = 1;\nconst x = process.env.SECRET;";

    // Act
    const result = await runCursorPrReview(
      { listChangedFiles, readTextFile },
      { baseRef: "origin/main", headRef: "HEAD" },
    );

    // Assert
    expect(result.findings).toEqual([
      expect.objectContaining({
        ruleId: "env-variables",
        severity: "error",
        filePath: "apps/x/src/foo.ts",
        line: 2,
      }),
      expect.objectContaining({
        ruleId: "env-variables",
        severity: "error",
        filePath: "apps/x/src/bar.tsx",
        line: 2,
      }),
      expect.objectContaining({
        ruleId: "env-variables",
        severity: "error",
        filePath: "apps/x/src/baz.js",
        line: 2,
      }),
    ]);
  });

  it("adds a react-custom-hooks error when TSX uses useState/useEffect", async () => {
    // Setup
    const listChangedFiles = async () => [
      { status: "M", filePath: "apps/x/src/component.tsx" },
    ];
    const readTextFile = async () => `
      import { useEffect, useState } from "react";
      export const Component = () => {
        const [x, setX] = useState(0);
        useEffect(() => {}, []);
        return null;
      };
    `;

    // Act
    const result = await runCursorPrReview(
      { listChangedFiles, readTextFile },
      { baseRef: "origin/main", headRef: "HEAD" },
    );

    // Assert
    expect(result.findings).toEqual([
      expect.objectContaining({
        ruleId: "react-custom-hooks",
        severity: "error",
        filePath: "apps/x/src/component.tsx",
        line: 4,
      }),
    ]);
  });

  it("adds a prisma-migrations error when schema.prisma is touched and an existing migration.sql is modified", async () => {
    // Setup
    const listChangedFiles = async () => [
      {
        status: "M",
        filePath: "packages/mediapulse/database/prisma/schema.prisma",
      },
      {
        status: "M",
        filePath:
          "packages/mediapulse/database/prisma/migrations/20260101010101_test/migration.sql",
      },
    ];
    const readTextFile = async () => "";

    // Act
    const result = await runCursorPrReview(
      { listChangedFiles, readTextFile },
      { baseRef: "origin/main", headRef: "HEAD" },
    );

    // Assert
    expect(result.findings).toEqual([
      expect.objectContaining({
        ruleId: "prisma-migrations",
        severity: "error",
      }),
    ]);
  });

  it("does not add a prisma-migrations error when schema.prisma is not touched", async () => {
    // Setup
    const listChangedFiles = async () => [
      {
        status: "M",
        filePath:
          "packages/mediapulse/database/prisma/migrations/20260101010101_test/migration.sql",
      },
    ];
    const readTextFile = async () => "";

    // Act
    const result = await runCursorPrReview(
      { listChangedFiles, readTextFile },
      { baseRef: "origin/main", headRef: "HEAD" },
    );

    // Assert
    expect(result.findings).toEqual([]);
  });

  it("allows adding a new migration.sql together with schema.prisma changes", async () => {
    // Setup
    const listChangedFiles = async () => [
      {
        status: "M",
        filePath: "packages/mediapulse/database/prisma/schema.prisma",
      },
      {
        status: "A",
        filePath:
          "packages/mediapulse/database/prisma/migrations/20990101010101_new/migration.sql",
      },
    ];
    const readTextFile = async () => "";

    // Act
    const result = await runCursorPrReview(
      { listChangedFiles, readTextFile },
      { baseRef: "origin/main", headRef: "HEAD" },
    );

    // Assert
    expect(result.findings).toEqual([]);
  });

  it("adds prisma-strong-typing warnings for obvious anti-patterns in Prisma-related files", async () => {
    // Setup
    const listChangedFiles = async () => [
      { status: "M", filePath: "packages/x/src/query.ts" },
      { status: "M", filePath: "packages/x/src/not-prisma.ts" },
    ];
    const readTextFile = async (filePath: string) => {
      if (filePath.endsWith("not-prisma.ts")) {
        return "export const x = 1 as unknown as number;";
      }
      return `
        import { Prisma } from "@prisma/client";
        const prisma = {} as unknown as { user: { findMany: (a: any) => unknown } };
        const args = {} as unknown as Prisma.UserFindManyArgs;
        prisma.user.findMany(args);
      `;
    };

    // Act
    const result = await runCursorPrReview(
      { listChangedFiles, readTextFile },
      { baseRef: "origin/main", headRef: "HEAD" },
    );

    // Assert
    expect(result.findings).toEqual([
      expect.objectContaining({
        ruleId: "prisma-strong-typing",
        severity: "warning",
        filePath: "packages/x/src/query.ts",
        line: 3,
      }),
      expect.objectContaining({
        ruleId: "prisma-strong-typing",
        severity: "warning",
        filePath: "packages/x/src/query.ts",
        line: 3,
      }),
    ]);
  });

  it("warns on inline Prisma delegate calls that pass an object literal", async () => {
    // Setup
    const listChangedFiles = async () => [
      { status: "M", filePath: "packages/x/src/inline.ts" },
    ];
    const readTextFile = async () => `
      const prisma = { user: { findMany: async (_args: unknown) => null } };
      await prisma.user.findMany({ take: 1 });
    `;

    // Act
    const result = await runCursorPrReview(
      { listChangedFiles, readTextFile },
      { baseRef: "origin/main", headRef: "HEAD" },
    );

    // Assert
    expect(
      result.findings.some(
        (f) => f.ruleId === "prisma-strong-typing" && f.line === 3,
      ),
    ).toBe(true);
  });

  it("warns when a newly added file exports a function without a preceding JSDoc block", async () => {
    // Setup
    const listChangedFiles = async () => [
      { status: "A", filePath: "packages/x/src/new-fn.ts" },
      { status: "A", filePath: "packages/x/src/new-fn.test.ts" },
    ];
    const readTextFile = async (filePath: string) =>
      filePath.endsWith("new-fn.test.ts")
        ? `import { describe, it, expect } from "vitest";
           import { foo } from "./new-fn";
           describe("foo", () => { it("works", () => { expect(foo()).toBe(1); }); });`
        : "export function foo() { return 1; }\n";

    // Act
    const result = await runCursorPrReview(
      { listChangedFiles, readTextFile },
      { baseRef: "origin/main", headRef: "HEAD" },
    );

    // Assert
    expect(
      result.findings.some(
        (f) =>
          f.ruleId === "typescript-javascript-standards" &&
          f.message.includes("JSDoc"),
      ),
    ).toBe(true);
  });

  it("does not warn when a newly added file includes JSDoc before exported functions", async () => {
    // Setup
    const listChangedFiles = async () => [
      { status: "A", filePath: "packages/x/src/doc-fn.ts" },
      { status: "A", filePath: "packages/x/src/doc-fn.test.ts" },
    ];
    const readTextFile = async (filePath: string) =>
      filePath.endsWith("doc-fn.test.ts")
        ? `import { describe, it, expect } from "vitest";
           import { foo } from "./doc-fn";
           describe("foo", () => { it("works", () => { expect(foo()).toBe(1); }); });`
        : "/** Test fn */\nexport function foo() { return 1; }\n";

    // Act
    const result = await runCursorPrReview(
      { listChangedFiles, readTextFile },
      { baseRef: "origin/main", headRef: "HEAD" },
    );

    // Assert
    expect(result.findings.some((f) => f.message.includes("JSDoc"))).toBe(
      false,
    );
  });

  it("warns when a newly added TS file exports but lacks a co-located test in the same diff", async () => {
    // Setup
    const listChangedFiles = async () => [
      { status: "A", filePath: "packages/x/src/exported.ts" },
    ];
    const readTextFile = async () => "export const x = 1;\n";

    // Act
    const result = await runCursorPrReview(
      { listChangedFiles, readTextFile },
      { baseRef: "origin/main", headRef: "HEAD" },
    );

    // Assert
    expect(result.findings.some((f) => f.message.includes("co-located"))).toBe(
      true,
    );
  });

  it("does not warn about tests for a newly added TS file when the diff includes a co-located test", async () => {
    // Setup
    const listChangedFiles = async () => [
      { status: "A", filePath: "packages/x/src/exported.ts" },
      { status: "A", filePath: "packages/x/src/exported.test.ts" },
    ];
    const readTextFile = async (filePath: string) =>
      filePath.endsWith("exported.test.ts")
        ? `import { describe, it, expect } from "vitest";
           describe("exported", () => { it("x", () => { expect(1).toBe(1); }); });`
        : "export const x = 1;\n";

    // Act
    const result = await runCursorPrReview(
      { listChangedFiles, readTextFile },
      { baseRef: "origin/main", headRef: "HEAD" },
    );

    // Assert
    expect(result.findings.some((f) => f.message.includes("co-located"))).toBe(
      false,
    );
  });
});
