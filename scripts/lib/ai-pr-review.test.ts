import { describe, expect, it } from "vitest";

import {
  buildAiReviewPrompt,
  selectSkillRelativePaths,
  truncateContextChunks,
  truncateMiddle,
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
  });
});
