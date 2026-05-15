/**
 * Exports an agent package config Zod schema as JSON Schema (same shape as GET /schemas).
 * Run from repo root after checking out the branch that owns the schema.
 *
 * @example
 * pnpm exec tsx apps/hermes/dashboard/scripts/export-mp-agent-prompts-config-schema.ts article-analysis
 */

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { enrichConfigSchemaForHermesUi } from "../../../../packages/shared/agent-runtime/src/enrich-config-schema-for-hermes-ui.js";
import { zodToJsonSchema } from "zod-to-json-schema";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../..",
);

const AGENT_EXPORTS: Record<
  string,
  { packageDir: string; exportName: string; modulePath: string }
> = {
  "article-analysis": {
    packageDir: "apps/mediapulse/agents/article-analysis",
    modulePath: "src/config-schema.ts",
    exportName: "articleAnalysisConfigSchema",
  },
  "query-analysis": {
    packageDir: "apps/mediapulse/agents/query-analysis",
    modulePath: "src/config-schema.ts",
    exportName: "queryAnalysisConfigSchema",
  },
  "content-generation": {
    packageDir: "apps/mediapulse/agents/content-generation",
    modulePath: "src/config-schema.ts",
    exportName: "ContentGenerationConfigSchema",
  },
};

/**
 * Resolves CLI agent id and output directory.
 */
const parseArgs = (): { agentId: string; outDir: string } => {
  const agentId = process.argv[2];
  const outDir =
    process.argv[3] ??
    path.join(
      repoRoot,
      "artifacts/ui-evidence/mp-agent-prompts-hermes/schemas",
    );
  if (!agentId || !AGENT_EXPORTS[agentId]) {
    const allowed = Object.keys(AGENT_EXPORTS).join(", ");
    throw new Error(
      `Usage: tsx export-mp-agent-prompts-config-schema.ts <${allowed}> [outDir]`,
    );
  }
  return { agentId, outDir };
};

/**
 * Dynamically imports the agent config schema and writes JSON Schema to disk.
 */
const main = async (): Promise<void> => {
  const { agentId, outDir } = parseArgs();
  const spec = AGENT_EXPORTS[agentId]!;
  const moduleUrl = path.join(repoRoot, spec.packageDir, spec.modulePath);
  const mod = (await import(moduleUrl)) as Record<string, unknown>;
  const zodSchema = mod[spec.exportName];
  if (zodSchema == null || typeof zodSchema !== "object") {
    throw new Error(`Missing export ${spec.exportName} in ${moduleUrl}`);
  }

  const configSchema = enrichConfigSchemaForHermesUi(
    zodToJsonSchema(zodSchema as never, {
      $refStrategy: "none",
    }) as Record<string, unknown>,
  );

  mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `${agentId}.json`);
  writeFileSync(outPath, `${JSON.stringify(configSchema, null, 2)}\n`, "utf8");
  process.stdout.write(`${outPath}\n`);
};

await main();
