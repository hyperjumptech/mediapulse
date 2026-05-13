/**
 * Idempotent seed script: creates or updates the "Default" AgentConfig rows for
 * the article-analysis and content-generation agents with production-quality settings.
 *
 * Changes applied:
 *   - article-analysis: rebalances relevance weights toward fundamentals and ticker
 *     salience, lowers the minimum score threshold.
 *   - content-generation: raises topNewsCount to 5 so subscribers receive more substance.
 *
 * Run from the hermes/dashboard app directory:
 *   pnpm exec tsx scripts/seed-default-agent-configs.ts
 *
 * Safe to re-run — existing rows are updated, not duplicated.
 */
import fs from "fs";
import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import type { PrismaClientWithSchema } from "@hermes/orchestration-database/client";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Agent config definition for seeding. */
type AgentConfigDefinition = {
  agentId: string;
  agentVersion: string;
  name: string;
  description: string;
  config: Record<string, unknown>;
};

const AGENT_CONFIG_DEFINITIONS: AgentConfigDefinition[] = [
  {
    agentId: "analysis",
    agentVersion: "1.0.0",
    name: "Default",
    description:
      "Default article-analysis config: weights rebalanced toward fundamentals and ticker salience, lower minimum score threshold.",
    config: {
      relevanceWeightBreakingNews: 0.1,
      relevanceWeightKgRelation: 0.2,
      relevanceWeightFundamental: 0.3,
      relevanceWeightTickerSalience: 0.3,
      relevanceWeightSourceQuality: 0.1,
      relevanceMinScore: 0.3,
    },
  },
  {
    agentId: "content-generation",
    agentVersion: "1.0.0",
    name: "Default",
    description:
      "Default content-generation config: 5 top-news items per newsletter for more subscriber substance.",
    config: {
      output: {
        topNewsCount: 5,
      },
    },
  },
];

/**
 * Loads script environment variables from the Hermes dashboard .env.local file.
 */
const loadHermesScriptEnv = (): void => {
  const envPath = path.resolve(__dirname, "../.env.local");
  if (!fs.existsSync(envPath)) {
    console.error("The .env.local file does not exist in the app root.");
    process.exit(1);
  }
  config({ path: envPath });
  console.log(`Loading environment variables from ${envPath}`);
};

/**
 * Creates or updates a single AgentConfig row.
 *
 * @param db - Database client.
 * @param definition - Config definition to upsert.
 * @returns Whether the row was created (`true`) or updated (`false`).
 */
export const upsertAgentConfig = async (
  db: PrismaClientWithSchema,
  definition: AgentConfigDefinition,
): Promise<boolean> => {
  const existing = await db.agentConfig.findFirst({
    where: {
      agentId: definition.agentId,
      agentVersion: definition.agentVersion,
      name: definition.name,
    },
    select: { id: true },
  });

  if (existing) {
    await db.agentConfig.update({
      where: { id: existing.id },
      data: {
        description: definition.description,
        config: definition.config,
      },
    });
    console.log(
      `Updated AgentConfig: ${definition.agentId}@${definition.agentVersion} "${definition.name}"`,
    );
    return false;
  }

  await db.agentConfig.create({
    data: {
      agentId: definition.agentId,
      agentVersion: definition.agentVersion,
      name: definition.name,
      description: definition.description,
      config: definition.config,
    },
  });
  console.log(
    `Created AgentConfig: ${definition.agentId}@${definition.agentVersion} "${definition.name}"`,
  );
  return true;
};

/**
 * Seeds default AgentConfig rows for article-analysis and content-generation.
 * The operation is idempotent and safe to re-run.
 *
 * @param db - Optional injected database client for tests.
 * @returns Count of created and updated configs.
 */
export const seedDefaultAgentConfigs = async (
  db?: PrismaClientWithSchema,
): Promise<{ created: number; updated: number }> => {
  const targetDb =
    db ?? (await import("@hermes/orchestration-database")).prisma;

  let created = 0;
  let updated = 0;
  for (const definition of AGENT_CONFIG_DEFINITIONS) {
    const wasCreated = await upsertAgentConfig(targetDb, definition);
    if (wasCreated) {
      created += 1;
    } else {
      updated += 1;
    }
  }
  return { created, updated };
};

/**
 * Runs the agent config seed as a CLI script.
 */
const main = async (): Promise<void> => {
  loadHermesScriptEnv();
  const result = await seedDefaultAgentConfigs();
  console.log(
    `Seeded default agent configs: ${result.created} created, ${result.updated} updated.`,
  );
};

const isCliEntry = process.argv[1]
  ? path.resolve(process.argv[1]) === __filename
  : false;

if (isCliEntry) {
  main()
    .then(() => process.exit(0))
    .catch((error: unknown) => {
      console.error("Failed to seed default agent configs", error);
      process.exit(1);
    });
}
