import { describe, expect, it } from "vitest";

import {
  filterPrettierEligiblePaths,
  isPrettierEligiblePath,
  listChangedPrettierPaths,
  parseGitDiffNameOnly,
  runPrettierCheck,
  runPrettierCheckChanged,
} from "./prettier-check-changed.mjs";

describe("isPrettierEligiblePath", () => {
  it("accepts ts, tsx, and md paths", () => {
    expect(isPrettierEligiblePath("apps/foo/src/a.ts")).toBe(true);
    expect(isPrettierEligiblePath("apps/foo/src/a.tsx")).toBe(true);
    expect(isPrettierEligiblePath("README.md")).toBe(true);
  });

  it("rejects other extensions", () => {
    expect(isPrettierEligiblePath("package.json")).toBe(false);
    expect(isPrettierEligiblePath("apps/foo/Dockerfile")).toBe(false);
  });
});

describe("parseGitDiffNameOnly", () => {
  it("parses trimmed non-empty lines", () => {
    // Act
    const paths = parseGitDiffNameOnly(
      "apps/a/foo.ts\n\npackages/b/bar.tsx\n  \n",
    );

    // Assert
    expect(paths).toEqual(["apps/a/foo.ts", "packages/b/bar.tsx"]);
  });
});

describe("filterPrettierEligiblePaths", () => {
  it("keeps only prettier-eligible paths", () => {
    // Act
    const paths = filterPrettierEligiblePaths([
      "apps/a/foo.ts",
      "pnpm-lock.yaml",
      "dev-docs/guide.mdx",
    ]);

    // Assert
    expect(paths).toEqual(["apps/a/foo.ts"]);
  });
});

describe("listChangedPrettierPaths", () => {
  it("filters git diff output to eligible paths", () => {
    // Setup
    const execFileSync = () =>
      "apps/a/foo.ts\npackage.json\npackages/b/readme.md\n";

    // Act
    const paths = listChangedPrettierPaths({
      baseRef: "base",
      headRef: "head",
      execFileSync,
    });

    // Assert
    expect(paths).toEqual(["apps/a/foo.ts", "packages/b/readme.md"]);
  });
});

describe("runPrettierCheck", () => {
  it("skips prettier when there are no paths", () => {
    // Setup
    let called = false;
    const execFileSync = () => {
      called = true;
    };

    // Act
    runPrettierCheck({ paths: [], execFileSync });

    // Assert
    expect(called).toBe(false);
  });

  it("runs prettier check on provided paths", () => {
    // Setup
    const calls: string[][] = [];
    const execFileSync = (
      command: string,
      args: string[],
      _options: unknown,
    ) => {
      calls.push([command, ...args]);
    };

    // Act
    runPrettierCheck({
      paths: ["apps/a/foo.ts"],
      execFileSync: execFileSync as typeof import("node:child_process").execFileSync,
    });

    // Assert
    expect(calls).toEqual([
      ["pnpm", "exec", "prettier", "--check", "apps/a/foo.ts"],
    ]);
  });
});

describe("runPrettierCheckChanged", () => {
  it("returns checked=false when no eligible files changed", () => {
    // Setup
    const execFileSync = () => "package.json\n";

    // Act
    const result = runPrettierCheckChanged({
      baseRef: "base",
      headRef: "head",
      execFileSync,
    });

    // Assert
    expect(result).toEqual({ paths: [], checked: false });
  });

  it("runs prettier when eligible files changed", () => {
    // Setup
    const calls: string[][] = [];
    const execFileSync = (
      command: string,
      args: string[],
      _options: unknown,
    ) => {
      if (command === "git") {
        return "apps/a/foo.ts\n";
      }

      calls.push([command, ...args]);
    };

    // Act
    const result = runPrettierCheckChanged({
      baseRef: "base",
      headRef: "head",
      execFileSync: execFileSync as typeof import("node:child_process").execFileSync,
    });

    // Assert
    expect(result).toEqual({ paths: ["apps/a/foo.ts"], checked: true });
    expect(calls).toEqual([
      ["pnpm", "exec", "prettier", "--check", "apps/a/foo.ts"],
    ]);
  });
});
