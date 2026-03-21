/**
 * Seed the default knowledge-graph vocabulary (entity types and relation types).
 * The operation is idempotent and safe to run multiple times because rows are upserted by name.
 * The script can be run standalone: `pnpm dlx tsx scripts/seed-kg-vocabulary.ts`
 */

import { config } from "dotenv";
import fs from "fs";
import path from "path";
import type { PrismaClientWithSchema } from "@mediapulse/database/client";
import { fileURLToPath } from "url";

const DEFAULT_ENTITY_TYPES = [
  {
    name: "COMPANY",
    description: "A registered business, corporation, or organization",
  },
  {
    name: "PERSON",
    description: "An individual such as an executive, regulator, or analyst",
  },
  {
    name: "TOPIC",
    description:
      "A recurring theme, policy, or subject area (e.g. DMO, ESG, inflation)",
  },
  {
    name: "EVENT",
    description:
      "A time-bound occurrence such as an earnings release, IPO, or regulatory change",
  },
  {
    name: "PRODUCT",
    description: "A specific product, service, or brand",
  },
  {
    name: "SECTOR",
    description: "An industry, market segment, or economic sector",
  },
] as const;

const DEFAULT_RELATION_TYPES = [
  {
    name: "CEO_OF",
    description: "Person is the CEO or top executive of a company",
  },
  {
    name: "SUBSIDIARY_OF",
    description: "Company is a subsidiary or child entity of another company",
  },
  {
    name: "PARENT_OF",
    description: "Company is the parent or holding entity of another company",
  },
  {
    name: "COMPETITOR",
    description: "Companies compete in the same market or segment",
  },
  {
    name: "SECTOR_PEER",
    description: "Companies operate in the same industry sector",
  },
  {
    name: "INVESTOR_IN",
    description: "Entity has invested in or holds a stake in another entity",
  },
  {
    name: "PARTNER_OF",
    description: "Entities have a business partnership or collaboration",
  },
] as const;

type SeedKgVocabularyResult = {
  entityTypesSeeded: number;
  relationTypesSeeded: number;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Loads Hermes script environment variables from the app-local .env file.
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
 * Seeds the default knowledge-graph vocabulary (entity types and relation types).
 * The operation is idempotent and safe to run multiple times because rows are upserted by name.
 */
export const seedKgVocabulary = async (
  db?: PrismaClientWithSchema,
): Promise<SeedKgVocabularyResult> => {
  const targetDb = db ?? (await import("@mediapulse/database")).prisma;

  for (const entityType of DEFAULT_ENTITY_TYPES) {
    await targetDb.entityType.upsert({
      where: { name: entityType.name },
      create: {
        name: entityType.name,
        description: entityType.description,
      },
      update: {
        description: entityType.description,
      },
    });
  }

  for (const relationType of DEFAULT_RELATION_TYPES) {
    await targetDb.relationType.upsert({
      where: { name: relationType.name },
      create: {
        name: relationType.name,
        description: relationType.description,
      },
      update: {
        description: relationType.description,
      },
    });
  }

  return {
    entityTypesSeeded: DEFAULT_ENTITY_TYPES.length,
    relationTypesSeeded: DEFAULT_RELATION_TYPES.length,
  };
};

/**
 * Executes the KG vocabulary seed script from CLI.
 */
const main = async (): Promise<void> => {
  loadHermesScriptEnv();
  const result = await seedKgVocabulary();
  console.log(
    `Seeded ${result.entityTypesSeeded} entity types and ${result.relationTypesSeeded} relation types.`,
  );
};

const isCliEntry = process.argv[1]
  ? path.resolve(process.argv[1]) === __filename
  : false;

if (isCliEntry) {
  main()
    .then(() => process.exit(0))
    .catch((error: unknown) => {
      console.error("Failed to seed KG vocabulary", error);
      process.exit(1);
    });
}
