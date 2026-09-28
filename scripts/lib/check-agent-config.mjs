export const REQUIRED_LINKS = [
  { linkPath: ".claude/skills", targetPath: ".cursor/skills" },
  { linkPath: ".claude/agents", targetPath: ".cursor/agents" },
];

const REFERENCE_PATTERNS = [
  { kind: "skill", pattern: /\.cursor\/skills\/([a-z0-9-]+)/g },
  { kind: "skill", pattern: /\.\.\/([a-z0-9-]+)\/SKILL\.md/g },
  { kind: "rule", pattern: /\.cursor\/rules\/([a-z0-9-]+)\.mdc/g },
  { kind: "agent", pattern: /\.cursor\/agents\/([a-z0-9-]+)\.md/g },
];

const FRONTMATTER_NAME_PATTERN =
  /^---\n[\s\S]*?^name:\s*["']?([^"'\n]+?)["']?\s*$/m;

export const findBrokenReferences = ({ documents, available }) =>
  documents.flatMap(({ filePath, text }) =>
    REFERENCE_PATTERNS.flatMap(({ kind, pattern }) =>
      [...text.matchAll(pattern)]
        .map((match) => match[1])
        .filter((name) => !available[kind].has(name))
        .map((name) => ({
          filePath,
          message: `references missing ${kind} "${name}"`,
        })),
    ),
  );

export const findSkillNameMismatches = (skillDocuments) =>
  skillDocuments.flatMap(({ skillName, filePath, text }) => {
    const declaredName = FRONTMATTER_NAME_PATTERN.exec(text)?.[1];
    if (declaredName === skillName) {
      return [];
    }

    return [
      {
        filePath,
        message: `frontmatter name "${declaredName ?? "(missing)"}" does not match folder "${skillName}"`,
      },
    ];
  });

const stripExtension = (fileName, extension) =>
  fileName.endsWith(extension) ? fileName.slice(0, -extension.length) : null;

export const checkAgentConfig = async ({
  resolveRealPath,
  listDirectory,
  readTextFile,
  fileExists,
}) => {
  const findings = [];

  for (const { linkPath, targetPath } of REQUIRED_LINKS) {
    const [linkRealPath, targetRealPath] = await Promise.all([
      resolveRealPath(linkPath),
      resolveRealPath(targetPath),
    ]);
    if (linkRealPath === null || linkRealPath !== targetRealPath) {
      findings.push({
        filePath: linkPath,
        message: `must be a symlink to ${targetPath}`,
      });
    }
  }

  const skillNames = await listDirectory(".cursor/skills");
  const ruleNames = (await listDirectory(".cursor/rules"))
    .map((fileName) => stripExtension(fileName, ".mdc"))
    .filter(Boolean);
  const agentNames = (await listDirectory(".cursor/agents"))
    .map((fileName) => stripExtension(fileName, ".md"))
    .filter(Boolean);

  const skillDocuments = await Promise.all(
    skillNames.map(async (skillName) => {
      const filePath = `.cursor/skills/${skillName}/SKILL.md`;

      return { skillName, filePath, text: await readTextFile(filePath) };
    }),
  );
  const otherDocumentPaths = [
    ...ruleNames.map((ruleName) => `.cursor/rules/${ruleName}.mdc`),
    ...agentNames.map((agentName) => `.cursor/agents/${agentName}.md`),
  ];
  for (const rootDocument of ["AGENTS.md", "CLAUDE.md"]) {
    if (await fileExists(rootDocument)) {
      otherDocumentPaths.push(rootDocument);
    }
  }
  const otherDocuments = await Promise.all(
    otherDocumentPaths.map(async (filePath) => ({
      filePath,
      text: await readTextFile(filePath),
    })),
  );

  findings.push(...findSkillNameMismatches(skillDocuments));
  findings.push(
    ...findBrokenReferences({
      documents: [...skillDocuments, ...otherDocuments],
      available: {
        skill: new Set(skillNames),
        rule: new Set(ruleNames),
        agent: new Set(agentNames),
      },
    }),
  );

  return findings;
};
