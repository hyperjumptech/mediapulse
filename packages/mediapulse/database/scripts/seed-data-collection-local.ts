/**
 * Seed two real-world tickers and search queries for local testing of the data-collection agent.
 * The Agent Data API `GET dataCollection` reads `SearchQuery` rows by `tickerId`; this script
 * upserts rows with stable IDs so you can point the agent at a known `tickerId`.
 *
 * Run from the monorepo root:
 * `pnpm --filter @mediapulse/database run seed-data-collection-local`
 */

import { config } from "dotenv";
import fs from "fs";
import path from "path";
import type { Prisma } from "@mediapulse/database";
import type { PrismaClientWithSchema } from "../src/client";
import { fileURLToPath } from "url";

/**
 * Apple Inc. — stable UUID for local runs (`input.tickerId` for the data-collection agent).
 * Matches the id used in agent-data-api tests.
 */
export const DATA_COLLECTION_LOCAL_TICKER_ID =
  "11111111-1111-4111-a111-111111111111";

/** Microsoft Corporation — second seeded ticker for local runs. */
export const DATA_COLLECTION_LOCAL_TICKER_MSFT_ID =
  "44444444-4444-4444-a444-444444444444";

/** Stable active query-set ids for seeded tickers (versioned query model). */
export const DATA_COLLECTION_LOCAL_SET_AAPL_ID =
  "aaaaaaaa-1111-4111-a111-111111111111";
export const DATA_COLLECTION_LOCAL_SET_MSFT_ID =
  "aaaaaaaa-4444-4444-a444-444444444444";

/**
 * Two liquid US equities with realistic display names and web-style search strings.
 * IDs are fixed so re-seeding updates the same rows.
 */
export const DATA_COLLECTION_LOCAL_TICKERS = [
  {
    id: DATA_COLLECTION_LOCAL_TICKER_ID,
    querySetId: DATA_COLLECTION_LOCAL_SET_AAPL_ID,
    symbol: "AAPL",
    name: "Apple Inc.",
    queries: [
      {
        id: "22222222-2222-4222-a222-222222222222",
        text: "Apple AAPL quarterly earnings revenue iPhone Services",
      },
      {
        id: "33333333-3333-4333-a333-333333333333",
        text: "Apple supply chain China manufacturing Tim Cook",
      },
    ],
  },
  {
    id: DATA_COLLECTION_LOCAL_TICKER_MSFT_ID,
    querySetId: DATA_COLLECTION_LOCAL_SET_MSFT_ID,
    symbol: "MSFT",
    name: "Microsoft Corporation",
    queries: [
      {
        id: "55555555-5555-4555-a555-555555555555",
        text: "Microsoft MSFT Azure cloud revenue Satya Nadella",
      },
      {
        id: "66666666-6666-4666-a666-666666666666",
        text: "Microsoft Windows Office 365 Copilot AI",
      },
    ],
  },
] as const;

export type SeedDataCollectionLocalTickerResult = {
  tickerId: string;
  symbol: string;
  name: string;
  searchQueryIds: readonly string[];
};

export type SeedDataCollectionLocalResult = {
  tickers: readonly SeedDataCollectionLocalTickerResult[];
};

/** Minimal Prisma delegate shape for {@link seedDataCollectionLocal} (inject for tests). */
export type DataCollectionLocalDb = {
  ticker: Pick<PrismaClientWithSchema["ticker"], "upsert">;
  searchQuerySet: Pick<PrismaClientWithSchema["searchQuerySet"], "upsert">;
  searchQuery: Pick<PrismaClientWithSchema["searchQuery"], "upsert">;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Loads Mediapulse env for CLI execution (`packages/mediapulse/env/.env`).
 */
const loadMediapulseScriptEnv = (): void => {
  const envPath = path.resolve(__dirname, "../../env/.env");
  if (!fs.existsSync(envPath)) {
    console.error(
      `Expected ${envPath} (copy from env.example and set MEDIAPULSE_DATABASE_URL).`,
    );
    process.exit(1);
  }

  config({ path: envPath });
  console.log(`Loading environment variables from ${envPath}`);
};

/**
 * Upserts Apple (AAPL) and Microsoft (MSFT) plus their search queries. Safe to run repeatedly (idempotent).
 *
 * @param db - Optional Prisma client (defaults to production client from `@mediapulse/database`).
 * @returns Each ticker id, symbol, name, and its search query ids.
 */
export const seedDataCollectionLocal = async (
  db?: DataCollectionLocalDb,
): Promise<SeedDataCollectionLocalResult> => {
  const targetDb = db ?? (await import("../src/index")).prisma;

  const tickers: SeedDataCollectionLocalTickerResult[] = [];

  for (const tickerRow of DATA_COLLECTION_LOCAL_TICKERS) {
    const tickerUpsert = {
      where: { id: tickerRow.id },
      create: {
        id: tickerRow.id,
        symbol: tickerRow.symbol,
        name: tickerRow.name,
      },
      update: {
        symbol: tickerRow.symbol,
        name: tickerRow.name,
      },
    } satisfies Prisma.TickerUpsertArgs;

    await targetDb.ticker.upsert(tickerUpsert);

    const setUpsert = {
      where: { id: tickerRow.querySetId },
      create: {
        id: tickerRow.querySetId,
        tickerId: tickerRow.id,
        generatedAt: new Date(),
        isActive: true,
        strategySnapshot: { seeded: true },
        generationSource: "seed_local",
        agentJobId: null,
      },
      update: {
        isActive: true,
        tickerId: tickerRow.id,
      },
    } satisfies Prisma.SearchQuerySetUpsertArgs;

    await targetDb.searchQuerySet.upsert(setUpsert);

    const searchQueryIds: string[] = [];

    for (const row of tickerRow.queries) {
      const searchQueryUpsert = {
        where: { id: row.id },
        create: {
          id: row.id,
          tickerId: tickerRow.id,
          setId: tickerRow.querySetId,
          text: row.text,
          source: "deterministic",
          intent: "fundamental",
          rank: 0,
        },
        update: {
          tickerId: tickerRow.id,
          setId: tickerRow.querySetId,
          text: row.text,
        },
      } satisfies Prisma.SearchQueryUpsertArgs;

      await targetDb.searchQuery.upsert(searchQueryUpsert);
      searchQueryIds.push(row.id);
    }

    tickers.push({
      tickerId: tickerRow.id,
      symbol: tickerRow.symbol,
      name: tickerRow.name,
      searchQueryIds,
    });
  }

  return { tickers };
};

/**
 * Executes the data-collection local seed script from CLI.
 */
const main = async (): Promise<void> => {
  loadMediapulseScriptEnv();
  const result = await seedDataCollectionLocal();
  for (const t of result.tickers) {
    console.log(
      `Seeded ${t.symbol} (${t.name}): tickerId=${t.tickerId}, searchQueryIds=${t.searchQueryIds.join(", ")}`,
    );
  }
};

const isCliEntry = process.argv[1]
  ? path.resolve(process.argv[1]) === __filename
  : false;

if (isCliEntry) {
  main()
    .then(() => process.exit(0))
    .catch((error: unknown) => {
      console.error("Failed to seed data-collection local data", error);
      process.exit(1);
    });
}
