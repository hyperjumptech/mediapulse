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

/** Base port for agents; first agent gets this, then increment. */
const AGENT_PORT_BASE = 4010;

/**
 * Finds the next unused agent port by scanning existing env.agents.*.example files.
 * Returns the next port (max existing + 1), or AGENT_PORT_BASE if none exist.
 */
function nextAgentPort(envPkgPath: string): number {
  const portRe = /^PORT=(\d+)/m;
  let maxPort = AGENT_PORT_BASE - 1;
  const dir = envPkgPath;
  if (!fs.existsSync(dir)) return AGENT_PORT_BASE;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (!file.startsWith("env.agents.") || !file.endsWith(".example")) continue;
    const content = fs.readFileSync(path.join(dir, file), "utf8");
    const m = content.match(portRe);
    if (m) maxPort = Math.max(maxPort, Number(m[1]));
  }
  return maxPort + 1;
}

/**
 * Custom action: add env example file and update packages/mediapulse/env/package.json
 * (new build script, add to concurrently build list, new export).
 * Assigns a unique PORT not used by existing agents.
 * Optionally adds dev:agent-<name> to root package.json.
 */
const wireEnvPackage: PlopTypes.CustomActionFunction = (answers) => {
  const name = answers.agentName as string;
  const envExampleName = `env.agents.${name}.example`;
  const envOutputName = `agents-${name}`;
  const envPkgPath = path.join(ROOT, "packages", "mediapulse", "env");
  const envPkgJsonPath = path.join(envPkgPath, "package.json");
  const examplePath = path.join(envPkgPath, envExampleName);
  const templateExamplePath = path.join(
    ROOT,
    "packages",
    "mediapulse",
    "env",
    "env.agents.ticker-echo.example",
  );

  if (!fs.existsSync(templateExamplePath)) {
    return `Env template not found: ${templateExamplePath}`;
  }

  const port = nextAgentPort(envPkgPath);
  let exampleContent = fs.readFileSync(templateExamplePath, "utf8");
  exampleContent = exampleContent.replace(/ticker-echo/g, name);
  exampleContent = exampleContent.replace(
    /# Port this agent listens on \(.*\)\nPORT=\d+ #number #default/,
    `# Port this agent listens on (${name}: ${port})\nPORT=${port} #number #default`,
  );
  exampleContent = exampleContent.replace(
    /AGENT_PUBLIC_URL="http:\/\/localhost:\d+"/,
    `AGENT_PUBLIC_URL="http://localhost:${port}"`,
  );
  fs.writeFileSync(examplePath, exampleContent);

  const pkg = JSON.parse(fs.readFileSync(envPkgJsonPath, "utf8")) as Record<
    string,
    unknown
  >;
  const scripts = pkg.scripts as Record<string, string>;
  const buildKey = `build:agents.${name}`;
  scripts[buildKey] =
    `pnpm exec env-to-t3 -i ${envExampleName} -o src/${envOutputName}.ts`;
  const buildScript = scripts.build;
  if (!buildScript.includes(`"pnpm ${buildKey}"`)) {
    scripts.build = buildScript.replace(
      /"pnpm build:agents\.ticker-echo"/,
      `"pnpm build:agents.ticker-echo" "pnpm ${buildKey}"`,
    );
  }

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

  return `Wired env: ${examplePath}, updated packages/mediapulse/env/package.json and root package.json`;
};

/**
 * Registers the "agent" generator with Turbo Gen.
 * Scaffolds a new agent package from the ticker-echo template and wires @mediapulse/env.
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
          const dest = path.join(ROOT, "apps", "mediapulse", "agents", kebab);
          if (fs.existsSync(dest))
            return `apps/mediapulse/agents/${kebab} already exists`;
          return true;
        },
        filter: (value) => toKebab(value),
      },
    ],
    actions: [
      {
        type: "add",
        path: "apps/mediapulse/agents/{{agentName}}/package.json",
        templateFile: "templates/agent/package.json.hbs",
      },
      {
        type: "add",
        path: "apps/mediapulse/agents/{{agentName}}/src/index.ts",
        templateFile: "templates/agent/src/index.ts.hbs",
      },
      {
        type: "add",
        path: "apps/mediapulse/agents/{{agentName}}/src/index.test.ts",
        templateFile: "templates/agent/src/index.test.ts.hbs",
      },
      {
        type: "add",
        path: "apps/mediapulse/agents/{{agentName}}/src/run.ts",
        templateFile: "templates/agent/src/run.ts.hbs",
      },
      {
        type: "add",
        path: "apps/mediapulse/agents/{{agentName}}/src/run.test.ts",
        templateFile: "templates/agent/src/run.test.ts.hbs",
      },
      {
        type: "add",
        path: "apps/mediapulse/agents/{{agentName}}/tsconfig.json",
        templateFile: "templates/agent/tsconfig.json.hbs",
      },
      {
        type: "add",
        path: "apps/mediapulse/agents/{{agentName}}/turbo.json",
        templateFile: "templates/agent/turbo.json.hbs",
      },
      {
        type: "add",
        path: "apps/mediapulse/agents/{{agentName}}/vitest.config.ts",
        templateFile: "templates/agent/vitest.config.ts.hbs",
      },
      wireEnvPackage,
    ],
  });
}
