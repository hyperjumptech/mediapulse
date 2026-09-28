import { describe, expect, it } from "vitest";

import {
  checkAgentConfig,
  findBrokenReferences,
  findSkillNameMismatches,
} from "./check-agent-config.mjs";

const skillFile = (name: string, body = "") =>
  `---\nname: ${name}\ndescription: test\n---\n\n${body}`;

const createFakeRepo = (files: Record<string, string>) => {
  const directories = new Map<string, string[]>();
  for (const filePath of Object.keys(files)) {
    const segments = filePath.split("/");
    for (let depth = 1; depth < segments.length; depth += 1) {
      const directory = segments.slice(0, depth).join("/");
      const child = segments[depth] as string;
      const children = directories.get(directory) ?? [];
      if (!children.includes(child)) {
        children.push(child);
      }
      directories.set(directory, children);
    }
  }

  return {
    listDirectory: async (directory: string) =>
      [...(directories.get(directory) ?? [])].sort(),
    readTextFile: async (filePath: string) => files[filePath] ?? "",
    fileExists: async (filePath: string) => filePath in files,
  };
};

describe("findBrokenReferences", () => {
  it("reports references to skills, rules and agents that do not exist", () => {
    const findings = findBrokenReferences({
      documents: [
        {
          filePath: "AGENTS.md",
          text: "See .cursor/skills/ghost and ../phantom/SKILL.md, .cursor/rules/nope.mdc and .cursor/agents/missing.md.",
        },
      ],
      available: {
        skill: new Set(["real"]),
        rule: new Set(["real"]),
        agent: new Set(["real"]),
      },
    });

    expect(findings.map((finding) => finding.message)).toEqual([
      'references missing skill "ghost"',
      'references missing skill "phantom"',
      'references missing rule "nope"',
      'references missing agent "missing"',
    ]);
  });

  it("accepts references that resolve", () => {
    const findings = findBrokenReferences({
      documents: [
        {
          filePath: "AGENTS.md",
          text: "Use .cursor/skills/real/SKILL.md and .cursor/agents/real.md.",
        },
      ],
      available: {
        skill: new Set(["real"]),
        rule: new Set(),
        agent: new Set(["real"]),
      },
    });

    expect(findings).toEqual([]);
  });
});

describe("findSkillNameMismatches", () => {
  it("flags a skill whose frontmatter name differs from its folder", () => {
    const findings = findSkillNameMismatches([
      {
        skillName: "folder-name",
        filePath: ".cursor/skills/folder-name/SKILL.md",
        text: skillFile("other-name"),
      },
    ]);

    expect(findings).toEqual([
      {
        filePath: ".cursor/skills/folder-name/SKILL.md",
        message:
          'frontmatter name "other-name" does not match folder "folder-name"',
      },
    ]);
  });
});

describe("checkAgentConfig", () => {
  it("passes when links resolve and every reference exists", async () => {
    const repo = createFakeRepo({
      ".cursor/skills/alpha/SKILL.md": skillFile(
        "alpha",
        "See ../beta/SKILL.md",
      ),
      ".cursor/skills/beta/SKILL.md": skillFile("beta"),
      ".cursor/rules/standards.mdc": "Use .cursor/skills/alpha",
      ".cursor/agents/verifier.md": "Rule .cursor/rules/standards.mdc",
      "AGENTS.md": "Agent .cursor/agents/verifier.md",
    });

    const findings = await checkAgentConfig({
      ...repo,
      resolveRealPath: async (relativePath: string) =>
        `/repo/${relativePath.replace(".claude/", ".cursor/")}`,
    });

    expect(findings).toEqual([]);
  });

  it("reports a .claude folder that is not linked to .cursor", async () => {
    const repo = createFakeRepo({
      ".cursor/skills/alpha/SKILL.md": skillFile("alpha"),
    });

    const findings = await checkAgentConfig({
      ...repo,
      resolveRealPath: async (relativePath: string) =>
        relativePath === ".claude/agents" ? null : `/repo/${relativePath}`,
    });

    expect(findings.map((finding) => finding.filePath)).toEqual([
      ".claude/skills",
      ".claude/agents",
    ]);
  });
});
