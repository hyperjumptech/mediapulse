// cursor-pr-review-disable: env-variables
// Build-time bootstrap: reads MEDIAPULSE_ENV_BUILD_TARGETS before @mediapulse/env is generated.

import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  resolveMediapulseEnvBuildTargets,
  type MediapulseEnvBuildTargetKey,
} from "./resolve-mediapulse-env-build-targets";

const PACKAGE_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

/** Maps each build target to env-to-t3 input/output (package-relative paths). */
const TARGET_SPECS: Readonly<
  Record<MediapulseEnvBuildTargetKey, { input: string; output: string }>
> = {
  default: { input: "env.example", output: "src/index.ts" },
  "agents.data-collection": {
    input: "env.agents.data-collection.example",
    output: "src/agents-data-collection.ts",
  },
  "agents.content-generation": {
    input: "env.agents.content-generation.example",
    output: "src/agents-content-generation.ts",
  },
  "agents.delivery": {
    input: "env.agents.delivery.example",
    output: "src/agents-delivery.ts",
  },
  "agents.query-analysis": {
    input: "env.agents.query-analysis.example",
    output: "src/agents-query-analysis.ts",
  },
  "agents.article-analysis": {
    input: "env.agents.article-analysis.example",
    output: "src/agents-article-analysis.ts",
  },
  "agents.ticker-echo": {
    input: "env.agents.ticker-echo.example",
    output: "src/agents-ticker-echo.ts",
  },
  "agents.user-registration": {
    input: "env.agents.user-registration.example",
    output: "src/agents-user-registration.ts",
  },
  "app.user-registration": {
    input: "env.app.user-registration.example",
    output: "src/app-user-registration.ts",
  },
  "outlook-inbox": {
    input: "env.outlook-inbox.example",
    output: "src/outlook-inbox.ts",
  },
};

/**
 * Runs `env-to-t3` for each resolved Mediapulse env build target from the package root.
 *
 * @param envTargetsRaw - Optional override for tests; defaults to `process.env.MEDIAPULSE_ENV_BUILD_TARGETS`.
 */
export const runMediapulseEnvCodegen = (
  envTargetsRaw: string | undefined = process.env.MEDIAPULSE_ENV_BUILD_TARGETS,
): void => {
  const targets = resolveMediapulseEnvBuildTargets(envTargetsRaw);

  for (const target of targets) {
    const spec = TARGET_SPECS[target];
    execSync(
      `pnpm exec env-to-t3 -i ${JSON.stringify(spec.input)} -o ${JSON.stringify(spec.output)}`,
      { cwd: PACKAGE_ROOT, stdio: "inherit" },
    );
  }
};
