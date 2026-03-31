import { describe, expect, it } from "vitest";

import {
  buildAiReviewPrompt,
  selectSkillRelativePaths,
  truncateContextChunks,
  truncateMiddle,
  truncateRulesAndSkillsChunks,
} from "./ai-pr-review.mjs";

describe("truncateMiddle", () => {
  it("returns the original string when it fits in the max length", () => {
    // Act
    const out = truncateMiddle("hello", 100);

    // Assert
    expect(out).toBe("hello");
  });

  it("replaces the middle when the string is too long", () => {
    // Act
    const out = truncateMiddle(`${"a".repeat(120)}${"b".repeat(120)}`, 80);

    // Assert
    expect(out).toContain("…[truncated]…");
    expect(out.startsWith("aaaa")).toBe(true);
    expect(out.endsWith("bbbb")).toBe(true);
  });
});

describe("truncateRulesAndSkillsChunks", () => {
  it("reserves budget for skills so skill text is not dropped when rules are huge", () => {
    // Setup
    const hugeRules = {
      relPath: ".cursor/rules/huge.mdc",
      content: "R".repeat(50_000),
    };
    const skillChunk = {
      relPath: ".cursor/skills/vitest-unit-testing/SKILL.md",
      content: "SKILL_MARKER_SHOULD_APPEAR",
    };

    // Act
    const merged = truncateRulesAndSkillsChunks(
      [hugeRules],
      [skillChunk],
      20_000,
      0.4,
    );

    // Assert
    const joined = merged.map((c) => c.content).join("");
    expect(joined).toContain("SKILL_MARKER_SHOULD_APPEAR");
    expect(joined.length).toBeLessThanOrEqual(20_000);
  });

  it("uses the full budget for rules when there are no skills", () => {
    // Setup
    const a = { relPath: ".cursor/rules/a.mdc", content: "aaaa" };
    const b = { relPath: ".cursor/rules/b.mdc", content: "bbbb" };

    // Act
    const out = truncateRulesAndSkillsChunks([a, b], [], 8);

    // Assert
    expect(out).toEqual(truncateContextChunks([a, b], 8));
  });
});

describe("truncateContextChunks", () => {
  it("stops once the character budget is exhausted", () => {
    // Setup
    const chunks = [
      { relPath: ".cursor/rules/a.mdc", content: "aaaa" },
      { relPath: ".cursor/rules/b.mdc", content: "bbbb" },
    ];

    // Act
    const out = truncateContextChunks(chunks, 6);

    // Assert
    expect(out).toEqual([
      { relPath: ".cursor/rules/a.mdc", content: "aaaa" },
      {
        relPath: ".cursor/rules/b.mdc",
        content: "bb\n\n...[truncated]",
      },
    ]);
  });
});

describe("selectSkillRelativePaths", () => {
  it("selects Prisma skills when prisma paths change", () => {
    // Act
    const skills = selectSkillRelativePaths([
      "packages/mediapulse/database/prisma/schema.prisma",
    ]);

    // Assert
    expect(skills.some((s) => s.includes("prisma-strong-typing"))).toBe(true);
    expect(skills.some((s) => s.includes("prisma-migrate-dev"))).toBe(true);
  });

  it("selects React component skill for TSX changes", () => {
    // Act
    const skills = selectSkillRelativePaths(["apps/x/src/Panel.tsx"]);

    // Assert
    expect(skills.some((s) => s.includes("react-component"))).toBe(true);
  });

  it("selects vitest skill for TypeScript under apps/ or packages/", () => {
    // Act
    const skills = selectSkillRelativePaths(["packages/foo/src/index.ts"]);

    // Assert
    expect(skills.some((s) => s.includes("vitest-unit-testing"))).toBe(true);
  });

  it("selects organized-src-structure when changes touch apps/ or packages/", () => {
    // Act
    const fromApps = selectSkillRelativePaths([
      "apps/mediapulse/agents/foo/src/index.ts",
    ]);
    const fromPackages = selectSkillRelativePaths([
      "packages/shared/utils/src/x.ts",
    ]);

    // Assert
    expect(fromApps.some((s) => s.includes("organized-src-structure"))).toBe(
      true,
    );
    expect(
      fromPackages.some((s) => s.includes("organized-src-structure")),
    ).toBe(true);
  });

  it("selects DataQueue skills when paths reference dataqueue", () => {
    // Act
    const skills = selectSkillRelativePaths([
      "packages/jobs/src/dataqueue/handlers.ts",
    ]);

    // Assert
    expect(skills.some((s) => s.includes("dataqueue-core"))).toBe(true);
    expect(skills.some((s) => s.includes("dataqueue-advanced"))).toBe(true);
  });
});

describe("buildAiReviewPrompt", () => {
  it("embeds diff text and rule headings", () => {
    // Act
    const prompt = buildAiReviewPrompt({
      diffText: "diff --git a/x b/x",
      maxDiffChars: 5000,
      ruleChunks: [
        { relPath: ".cursor/rules/env-variables.mdc", content: "RULE" },
      ],
      skillChunks: [],
    });

    // Assert
    expect(prompt).toContain("TypeScript monorepo");
    expect(prompt).toContain(".cursor/rules/env-variables.mdc");
    expect(prompt).toContain("RULE");
    expect(prompt).toContain("diff --git a/x b/x");
    expect(prompt).toContain("## Findings");
    expect(prompt).toContain("| Tier | Rule | File | Line | Finding |");
    expect(prompt).toContain("Reviewer discipline");
    expect(prompt).toContain("No hollow praise");
    expect(prompt).toContain("Prisma migrations");
    expect(prompt).toContain("Systematically");
  });
});
