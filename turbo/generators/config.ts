import type { PlopTypes } from "@turbo/gen";
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = process.cwd();

/**
 * Normalizes a string to kebab-case for use as agent name (and package/env identifiers).
 * Replaces spaces with hyphens and lowercases.
 */
function toKebab(value: string): string {
  return (
    value
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/gi, "")
      .toLowerCase() || "my-agent"
  );
}

/**
 * Custom action: add env example file and update packages/env/package.json
 * (new build script, add to build script list, new export).
 * Optionally adds dev:agent-<name> to root package.json.
 */
const wireEnvPackage: PlopTypes.CustomActionFunction = (answers) => {
  const name = answers.agentName as string;
  const envExampleName = `env.agents.${name}.example`;
  const envOutputName = `agents-${name}`;
  const envPkgPath = path.join(ROOT, "packages", "env");
  const envPkgJsonPath = path.join(envPkgPath, "package.json");
  const examplePath = path.join(envPkgPath, envExampleName);
  const templateExamplePath = path.join(
    ROOT,
    "packages",
    "env",
    "env.agents.ticker-echo.example",
  );

  if (!fs.existsSync(templateExamplePath)) {
    return `Env template not found: ${templateExamplePath}`;
  }

  let exampleContent = fs.readFileSync(templateExamplePath, "utf8");
  exampleContent = exampleContent.replace(/ticker-echo/g, name);
  fs.writeFileSync(examplePath, exampleContent);

  const pkg = JSON.parse(fs.readFileSync(envPkgJsonPath, "utf8")) as Record<
    string,
    unknown
  >;
  const scripts = pkg.scripts as Record<string, string>;
  const buildKey = `build:agents.${name}`;
  scripts[buildKey] =
    `npx env-to-t3 -i ${envExampleName} -o src/${envOutputName}.ts`;
  const buildScript = scripts.build;
  scripts.build = buildScript.replace(
    '"pnpm build:hermes-worker"',
    `"pnpm build:hermes-worker" "pnpm ${buildKey}"`,
  );

  const exports = pkg.exports as Record<
    string,
    { types: string; default: string }
  >;
  exports[`./${envOutputName}`] = {
    types: `./src/${envOutputName}.ts`,
    default: `./src/${envOutputName}.ts`,
  };
  fs.writeFileSync(envPkgJsonPath, JSON.stringify(pkg, null, 2));

  const rootPkgPath = path.join(ROOT, "package.json");
  const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, "utf8")) as Record<
    string,
    unknown
  >;
  const rootScripts = rootPkg.scripts as Record<string, string>;
  rootScripts[`dev:agent-${name}`] = `turbo dev --filter=${name}-agent`;
  fs.writeFileSync(rootPkgPath, JSON.stringify(rootPkg, null, 2));

  return `Wired env: ${examplePath}, updated packages/env/package.json and root package.json`;
};

/**
 * Registers the "agent" generator with Turbo Gen.
 * Scaffolds a new agent package from the ticker-echo template and wires @workspace/env.
 */
export default function generator(plop: PlopTypes.NodePlopAPI): void {
  plop.setGenerator("agent", {
    description:
      "Generate a new agent package (from ticker-echo template) with env wiring",
    prompts: [
      {
        type: "input",
        name: "agentName",
        message: "Agent name (kebab-case, e.g. my-agent):",
        validate: (value) => {
          if (!value || !value.trim()) return "Agent name is required";
          const kebab = toKebab(value);
          if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(kebab))
            return "Use only letters, numbers, and hyphens (e.g. my-agent)";
          const dest = path.join(ROOT, "apps", "agents", kebab);
          if (fs.existsSync(dest)) return `apps/agents/${kebab} already exists`;
          return true;
        },
        filter: (value) => toKebab(value),
      },
    ],
    actions: [
      {
        type: "add",
        path: "apps/agents/{{agentName}}/package.json",
        templateFile: "templates/agent/package.json.hbs",
      },
      {
        type: "add",
        path: "apps/agents/{{agentName}}/src/index.ts",
        templateFile: "templates/agent/src/index.ts.hbs",
      },
      {
        type: "add",
        path: "apps/agents/{{agentName}}/src/index.test.ts",
        templateFile: "templates/agent/src/index.test.ts.hbs",
      },
      {
        type: "add",
        path: "apps/agents/{{agentName}}/tsconfig.json",
        templateFile: "templates/agent/tsconfig.json.hbs",
      },
      {
        type: "add",
        path: "apps/agents/{{agentName}}/turbo.json",
        templateFile: "templates/agent/turbo.json.hbs",
      },
      {
        type: "add",
        path: "apps/agents/{{agentName}}/vitest.config.ts",
        templateFile: "templates/agent/vitest.config.ts.hbs",
      },
      wireEnvPackage,
    ],
  });
}
