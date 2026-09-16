/**
 * Seed every issuer in `seed-data/ticker-profiles.json` as a Ticker plus its TickerProfile.
 *
 * The repository ships the profile export but no loader, so a fresh local database has no issuers
 * and every downstream surface (search queries, data sources, storylines) has nothing to hang off.
 * Idempotent: upserts by `symbol`, so re-running only refreshes fields.
 *
 * Run from the monorepo root:
 * `pnpm --filter @mediapulse/database run seed-tickers-local`
 */

import { config } from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../../../..");

config({ path: path.join(repoRoot, "packages/mediapulse/env/.env") });

type Localized = { id: string; en: string };
type NamedEntity = { name: string; aliases: string[] };

export type SeedProfile = {
  symbol: string;
  name: string;
  aliases: string[];
  company_overview: string;
  business_operation: string;
  sector: Localized;
  sub_sector: Localized;
  industry: Localized;
  sub_industry: Localized;
  competitors: NamedEntity[];
  regulators: NamedEntity[];
};

const asText = (value: unknown): string =>
  typeof value === "string" ? value : "";

const asTextList = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((entry) => typeof entry === "string")
    : [];

const asLocalized = (value: unknown): Localized | null => {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  if (typeof record.id !== "string" || typeof record.en !== "string")
    return null;

  return { id: record.id, en: record.en };
};

const asNamedEntities = (value: unknown): NamedEntity[] => {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry) => {
    if (typeof entry !== "object" || entry === null) return [];
    const record = entry as Record<string, unknown>;
    if (typeof record.name !== "string") return [];

    return [{ name: record.name, aliases: asTextList(record.aliases) }];
  });
};

/**
 * Coerces one raw export row into a seed profile.
 *
 * @param value - Raw JSON row.
 * @returns The profile, or null when required fields are missing or malformed.
 */
export function parseSeedProfile(value: unknown): SeedProfile | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  const symbol = record.symbol;
  const name = record.name;
  if (typeof symbol !== "string" || symbol.length === 0) return null;
  if (typeof name !== "string" || name.length === 0) return null;

  const sector = asLocalized(record.sector);
  const subSector = asLocalized(record.sub_sector);
  const industry = asLocalized(record.industry);
  const subIndustry = asLocalized(record.sub_industry);
  if (!sector || !subSector || !industry || !subIndustry) return null;

  return {
    symbol,
    name,
    aliases: asTextList(record.aliases),
    company_overview: asText(record.company_overview),
    business_operation: asText(record.business_operation),
    sector,
    sub_sector: subSector,
    industry,
    sub_industry: subIndustry,
    competitors: asNamedEntities(record.competitors),
    regulators: asNamedEntities(record.regulators),
  };
}

export const SEED_PROFILES_PATH = path.join(
  repoRoot,
  "seed-data/ticker-profiles.json",
);

/**
 * Reads and validates the shipped profile export.
 *
 * @param filePath - Absolute path to the profile JSON.
 * @returns Every profile row that parsed.
 */
export function readSeedProfiles(filePath: string): SeedProfile[] {
  const raw: unknown = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const rows = Array.isArray(raw) ? raw : [];

  return rows.flatMap((row) => {
    const parsed = parseSeedProfile(row);

    return parsed ? [parsed] : [];
  });
}

/**
 * Upserts one issuer and its profile.
 *
 * @param prisma - Mediapulse Prisma client.
 * @param profile - Validated profile row.
 */
export async function seedTickerProfile(
  prisma: {
    ticker: {
      upsert: (args: unknown) => Promise<{ id: string }>;
    };
    tickerProfile: { upsert: (args: unknown) => Promise<unknown> };
  },
  profile: SeedProfile,
): Promise<void> {
  const ticker = await prisma.ticker.upsert({
    where: { symbol: profile.symbol },
    create: {
      symbol: profile.symbol,
      name: profile.name,
      sector: profile.sector.en,
      subSector: profile.sub_sector.en,
      industry: profile.industry.en,
      subIndustry: profile.sub_industry.en,
      businessActivity: profile.business_operation,
      aliases: profile.aliases,
    },
    update: {
      name: profile.name,
      sector: profile.sector.en,
      subSector: profile.sub_sector.en,
      industry: profile.industry.en,
      subIndustry: profile.sub_industry.en,
      businessActivity: profile.business_operation,
      aliases: profile.aliases,
    },
  });

  const profileFields = {
    companyOverview: profile.company_overview,
    businessOperation: profile.business_operation,
    sectorIndonesian: profile.sector.id,
    sectorEnglish: profile.sector.en,
    subSectorIndonesian: profile.sub_sector.id,
    subSectorEnglish: profile.sub_sector.en,
    industryIndonesian: profile.industry.id,
    industryEnglish: profile.industry.en,
    subIndustryIndonesian: profile.sub_industry.id,
    subIndustryEnglish: profile.sub_industry.en,
    aliases: profile.aliases,
    competitors: profile.competitors,
    regulators: profile.regulators,
  };

  await prisma.tickerProfile.upsert({
    where: { tickerId: ticker.id },
    create: { tickerId: ticker.id, ...profileFields },
    update: profileFields,
  });
}

async function main(): Promise<void> {
  const { prisma } = await import("../src/index");
  const profiles = readSeedProfiles(SEED_PROFILES_PATH);
  let seeded = 0;
  for (const profile of profiles) {
    await seedTickerProfile(
      prisma as unknown as Parameters<typeof seedTickerProfile>[0],
      profile,
    );
    seeded += 1;
    if (seeded % 100 === 0) {
      console.log(`  seeded ${String(seeded)}/${String(profiles.length)}`);
    }
  }
  console.log(`Seeded ${String(seeded)} tickers and profiles.`);
  await (
    prisma as unknown as { $disconnect: () => Promise<void> }
  ).$disconnect();
}

if (
  process.argv[1] &&
  import.meta.url.endsWith(path.basename(process.argv[1]))
) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
