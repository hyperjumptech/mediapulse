/**
 * Data migration: page-collection AgentConfig curatedSources → CuratedSource table.
 *
 * Reads Hermes orchestration AgentConfig rows and upserts into mediapulse CuratedSource.
 *
 * Usage:
 *   pnpm tsx apps/mediapulse/scripts/migrate-curated-sources-from-agent-config.ts
 */
import { config } from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(__dirname, "../../hermes/dashboard/.env.local");
if (!fs.existsSync(envPath)) {
  console.error(`Missing ${envPath}. Run ./dev-bootstrap.sh first.`);
  process.exit(1);
}
config({ path: envPath });

type RawCuratedSource = {
  listingUrl?: string;
  enabled?: boolean;
  maxItems?: number;
};

type RawConfig = {
  curatedSources?: RawCuratedSource[];
};

/**
 * Extracts listing URLs from a page-collection agent config JSON blob.
 *
 * @param configValue - Parsed agent config object.
 */
const extractCuratedSources = (configValue: unknown): RawCuratedSource[] => {
  if (
    configValue === null ||
    typeof configValue !== "object" ||
    Array.isArray(configValue)
  ) {
    return [];
  }
  const parsed = configValue as RawConfig;
  return Array.isArray(parsed.curatedSources) ? parsed.curatedSources : [];
};

async function main() {
  const { prisma: orchPrisma } = await import("@hermes/orchestration-database");
  const { prisma: mediaPrisma } = await import("@mediapulse/database");

  const configs = await orchPrisma.agentConfig.findMany({
    where: { agentId: "page-collection" },
  });

  console.log(`Found ${configs.length} page-collection AgentConfig rows.`);

  let created = 0;
  let skipped = 0;

  for (const row of configs) {
    const sources = extractCuratedSources(row.config);
    for (const source of sources) {
      if (!source.listingUrl || typeof source.listingUrl !== "string") {
        skipped += 1;
        continue;
      }

      await mediaPrisma.curatedSource.upsert({
        where: { listingUrl: source.listingUrl },
        create: {
          listingUrl: source.listingUrl,
          enabled: source.enabled ?? true,
          maxItems: source.maxItems ?? null,
        },
        update: {
          enabled: source.enabled ?? true,
          ...(source.maxItems !== undefined
            ? { maxItems: source.maxItems }
            : {}),
        },
      });
      created += 1;
    }
  }

  console.log(`Upserted ${created} curated source(s); skipped ${skipped}.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
