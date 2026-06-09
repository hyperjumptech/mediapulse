/**
 * Data migration: page-collection AgentConfig rows — strategies[] → strategy (plan 106).
 *
 * For each curatedSource:
 *   - Sets `strategy` = first valid value in the old `strategies` array, else "rss".
 *   - Deletes the `strategies` key from the source object.
 * Deletes the top-level `defaultDiscoveryChain` key.
 *
 * Required because the JSON Schema is additionalProperties:false — stale keys
 * would fail the dashboard save path.
 *
 * Usage:
 *   pnpm tsx apps/hermes/dashboard/scripts/migrate-page-collection-single-strategy.ts
 */
import { config } from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(__dirname, "../.env.local");
if (!fs.existsSync(envPath)) {
  console.error(`Missing ${envPath}. Run ./dev-bootstrap.sh first.`);
  process.exit(1);
}
config({ path: envPath });

const VALID_STRATEGIES = new Set(["rss", "sitemap", "generic-links"]);

type RawCuratedSource = {
  listingUrl?: string;
  strategies?: unknown[];
  strategy?: string;
  enabled?: boolean;
  maxItems?: number;
  [key: string]: unknown;
};

type RawConfig = {
  curatedSources?: RawCuratedSource[];
  defaultDiscoveryChain?: unknown;
  [key: string]: unknown;
};

function migrateConfig(config: RawConfig): {
  migrated: RawConfig;
  changed: boolean;
} {
  let changed = false;
  const migrated = { ...config };

  if ("defaultDiscoveryChain" in migrated) {
    delete migrated.defaultDiscoveryChain;
    changed = true;
  }

  if (Array.isArray(migrated.curatedSources)) {
    migrated.curatedSources = migrated.curatedSources.map((source) => {
      const updated = { ...source };

      if ("strategies" in updated) {
        const strategies = updated.strategies;
        const firstValid = Array.isArray(strategies)
          ? (strategies.find(
              (value): value is string =>
                typeof value === "string" && VALID_STRATEGIES.has(value),
            ) ?? "rss")
          : "rss";

        if (!updated.strategy) {
          updated.strategy = firstValid;
        }

        delete updated.strategies;
        changed = true;
      }

      return updated;
    });
  }

  return { migrated, changed };
}

async function main() {
  const { createPrismaClient } =
    await import("@hermes/orchestration-database/client");
  const prisma = createPrismaClient();

  try {
    const configs = await prisma.agentConfig.findMany({
      where: { agentId: "page-collection" },
    });

    console.log(`Found ${configs.length} page-collection AgentConfig rows.`);

    let updatedCount = 0;

    for (const row of configs) {
      const rawConfig = row.config as RawConfig;
      const { migrated, changed } = migrateConfig(rawConfig);

      if (!changed) {
        continue;
      }

      await prisma.agentConfig.update({
        where: { id: row.id },
        data: { config: migrated },
      });

      updatedCount += 1;
      console.log(`  Updated config "${row.name}" (${row.id})`);
    }

    console.log(
      `Migration complete. ${updatedCount}/${configs.length} rows updated.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
