// cursor-pr-review-disable: env-variables
// Build-time bootstrap: reads HERMES_ENV_BUILD_TARGETS before @hermes/env is generated.

import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

import {
  resolveHermesEnvBuildTargets,
  type HermesEnvBuildTargetKey,
} from "./resolve-hermes-env-build-targets";

const PACKAGE_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const TARGET_SPECS: Readonly<
  Record<HermesEnvBuildTargetKey, { input: string; output: string }>
> = {
  default: { input: "env.example", output: "src/index.ts" },
  "hermes.worker": {
    input: "env.hermes-worker.example",
    output: "src/hermes-worker.ts",
  },
};

/**
 * Runs `env-to-t3` for each resolved Hermes env build target from the package root.
 *
 * @param envTargetsRaw - Optional override for tests; defaults to `process.env.HERMES_ENV_BUILD_TARGETS`.
 */
export const runHermesEnvCodegen = (
  envTargetsRaw: string | undefined = process.env.HERMES_ENV_BUILD_TARGETS,
): void => {
  const targets = resolveHermesEnvBuildTargets(envTargetsRaw);

  for (const target of targets) {
    const spec = TARGET_SPECS[target];
    execSync(
      `pnpm exec env-to-t3 -i ${JSON.stringify(spec.input)} -o ${JSON.stringify(spec.output)}`,
      { cwd: PACKAGE_ROOT, stdio: "inherit" },
    );
  }
};
