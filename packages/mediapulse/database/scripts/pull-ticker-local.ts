/**
 * Copy one issuer's articles from a remote Mediapulse database into the local one.
 *
 * The knowledge-base work needs a real corpus to extract from, and a fresh local database has
 * issuers (from `seed-tickers-local.ts`) but no articles. This reads a remote database directly and
 * writes through the local Prisma client, so the remote is never migrated and never written.
 *
 * Idempotent: every row keeps its source primary key, so a re-run refreshes rather than duplicates.
 *
 * Run from the monorepo root:
 * `pnpm --filter @mediapulse/database run pull-ticker-local -- --symbol FORE --source-url "postgresql://..." --apply`
 */

import { config } from "dotenv";
import fs from "fs";
import path from "path";
import { Pool } from "pg";
import { fileURLToPath } from "url";

import type { PrismaClientWithSchema } from "../src/client";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Rows copied per statement. Keeps one transaction well inside `TRANSACTION_TIMEOUT_MS`. */
export const PULL_CHUNK_SIZE = 200;

/** Minimal Prisma delegate shape for {@link pullTickerLocal} (inject for tests). */
export type PullTickerLocalDb = {
  ticker: Pick<PrismaClientWithSchema["ticker"], "findUnique">;
  tickerProfile: Pick<PrismaClientWithSchema["tickerProfile"], "upsert">;
  dataSource: Pick<PrismaClientWithSchema["dataSource"], "upsert">;
  dataSourceTickerSection: Pick<
    PrismaClientWithSchema["dataSourceTickerSection"],
    "upsert"
  >;
};

/** What a source database is asked for, and where each row is written. */
export type PullTickerLocalOptions = {
  symbol: string;
  sourceUrl: string;
  apply: boolean;
  limit?: number;
  /** Overrides the schema taken from the source URL's `schema` parameter. */
  sourceSchema?: string;
};

export type PullTickerLocalResult = {
  symbol: string;
  sourceTickerId: string;
  localTickerId: string;
  profilesWritten: number;
  articlesWritten: number;
  placementsWritten: number;
  /** Articles whose source `tickerId` belonged to another issuer and was dropped. */
  provenanceNulled: number;
  applied: boolean;
};

/**
 * Builds the query for the articles one issuer's knowledge base is built from.
 *
 * Both clauses are needed. The first alone misses curated and globally collected articles, whose
 * `ticker_id` is null or another issuer's but which carry a Placement for this issuer, and a
 * Placement is what decides that an article concerns the issuer at all.
 *
 * - Important: every table is schema-qualified rather than reached through a `search_path`. A pooled
 *   connection can serve a query before a session-level `SET` has run on it.
 *
 * @param schema - Schema holding the source tables.
 */
export const articleSelectionSql = (schema: string): string => `
  SELECT ds.*
  FROM ${quoteIdentifier(schema)}.data_source ds
  WHERE ds.ticker_id = $1
     OR ds.id IN (
       SELECT s.data_source_id
       FROM ${quoteIdentifier(schema)}.data_source_ticker_section s
       WHERE s.ticker_id = $1
     )
  ORDER BY ds.created_at DESC
`;

/**
 * Chooses the local `tickerId` for a copied article.
 *
 * - Important: another issuer's id is dropped rather than rewritten to this issuer. Remapping it
 *   would claim the article was collected for an issuer it was not, and the Placement row carries
 *   the per-issuer meaning anyway.
 *
 * @param sourceTickerId - The article's `ticker_id` in the source database.
 * @param pulledSourceTickerId - The id of the issuer being pulled, in the source database.
 * @param localTickerId - The same issuer's id locally.
 * @returns The id to store locally, or null when the provenance does not survive the copy.
 */
export const remapTickerId = (
  sourceTickerId: string | null,
  pulledSourceTickerId: string,
  localTickerId: string,
): string | null =>
  sourceTickerId === pulledSourceTickerId ? localTickerId : null;

type SourceRow = Record<string, unknown>;

/**
 * Splits a Prisma-style database URL into what `pg` accepts and the schema it names.
 *
 * @param sourceUrl - Database URL, which may carry Prisma's `?schema=` parameter.
 * @param override - Schema to use instead of the URL's.
 */
/**
 * Quotes a schema name for interpolation into SQL.
 *
 * @param identifier - Schema name from the source URL or the command line.
 * @throws When the name is not a plain SQL identifier, which would make the interpolation unsafe.
 */
export const quoteIdentifier = (identifier: string): string => {
  if (!/^[A-Za-z_][A-Za-z0-9_$]*$/u.test(identifier)) {
    throw new Error(`Refusing to use "${identifier}" as a schema name`);
  }

  return `"${identifier}"`;
};

export const parseSourceUrl = (
  sourceUrl: string,
  override?: string,
): { connectionString: string; schema: string } => {
  const parsed = new URL(sourceUrl);
  const schema = override ?? parsed.searchParams.get("schema") ?? "mediapulse";
  parsed.searchParams.delete("schema");
  parsed.search = parsed.searchParams.toString();

  return { connectionString: parsed.toString(), schema };
};

const asDate = (value: unknown): Date | null =>
  value instanceof Date ? value : null;

const asText = (value: unknown): string | null =>
  typeof value === "string" ? value : null;

const asNumber = (value: unknown): number | null =>
  typeof value === "number" ? value : null;

/**
 * Shapes one source `data_source` row for the local database.
 *
 * `searchQueryId`, `curatedSourceId` and `collectionGate*` provenance that points at tables this
 * script does not copy are dropped, because a dangling foreign key would fail the write and none of
 * it feeds the knowledge base.
 *
 * @param row - The source row.
 * @param localTickerId - The pulled issuer's local id.
 * @param sourceTickerId - The pulled issuer's id in the source database.
 */
export const toDataSourceUpsert = (
  row: SourceRow,
  localTickerId: string,
  sourceTickerId: string,
) => {
  const id = asText(row.id);
  if (id === null) {
    throw new Error("Source data_source row carries no id");
  }
  const url = asText(row.url) ?? "";
  const fields = {
    url,
    canonicalUrl: asText(row.canonical_url) ?? url,
    title: asText(row.title) ?? "",
    description: asText(row.description),
    content: asText(row.content),
    fetchedAt: asDate(row.fetched_at),
    fetchProvider: asText(row.fetch_provider),
    author: asText(row.author),
    source: asText(row.source),
    registrableDomain: asText(row.registrable_domain),
    publishedAt: asDate(row.published_at),
    analyzedAt: asDate(row.analyzed_at),
    section: asText(row.section),
    sectionScore: asNumber(row.section_score),
    sectionReason: asText(row.section_reason),
    tickerId: remapTickerId(
      asText(row.ticker_id),
      sourceTickerId,
      localTickerId,
    ),
  };

  return { where: { id }, create: { id, ...fields }, update: fields };
};

/**
 * Shapes one source `data_source_ticker_section` row for the local database.
 *
 * @param row - The source row.
 * @param localTickerId - The pulled issuer's local id.
 */
export const toPlacementUpsert = (row: SourceRow, localTickerId: string) => {
  const dataSourceId = asText(row.data_source_id);
  if (dataSourceId === null) {
    throw new Error("Source data_source_ticker_section row carries no article");
  }
  const fields = {
    section: asText(row.section),
    sectionScore: asNumber(row.section_score),
    sectionReason: asText(row.section_reason),
    analyzedAt: asDate(row.analyzed_at) ?? new Date(),
  };

  return {
    where: { dataSourceId_tickerId: { dataSourceId, tickerId: localTickerId } },
    create: { dataSourceId, tickerId: localTickerId, ...fields },
    update: fields,
  };
};

const chunked = <T>(items: readonly T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
};

/**
 * Copies one issuer's profile, articles and Placements from a remote database into the local one.
 *
 * @param options - Which issuer to pull, where from, and whether to write.
 * @param db - Optional local Prisma client (defaults to the client from `@mediapulse/database`).
 * @returns What was read and what was written.
 */
export const pullTickerLocal = async (
  options: PullTickerLocalOptions,
  db?: PullTickerLocalDb,
): Promise<PullTickerLocalResult> => {
  const targetDb = db ?? (await import("../src/index")).prisma;
  const local = await targetDb.ticker.findUnique({
    where: { symbol: options.symbol },
    select: { id: true },
  });
  if (local === null) {
    throw new Error(
      `${options.symbol} does not exist locally. Run seed-tickers-local first.`,
    );
  }

  const { connectionString, schema } = parseSourceUrl(
    options.sourceUrl,
    options.sourceSchema,
  );
  const pool = new Pool({
    connectionString,
    max: 4,
    connectionTimeoutMillis: 10_000,
  });

  try {
    const tickerResult = await pool.query<{ id: string }>(
      `SELECT id FROM ${quoteIdentifier(schema)}.ticker WHERE symbol = $1`,
      [options.symbol],
    );
    const sourceTicker = tickerResult.rows[0];
    if (sourceTicker === undefined) {
      throw new Error(
        `${options.symbol} does not exist in the source database`,
      );
    }

    const profileResult = await pool.query<SourceRow>(
      `SELECT * FROM ${quoteIdentifier(schema)}.ticker_profile WHERE ticker_id = $1`,
      [sourceTicker.id],
    );
    const articleResult = await pool.query<SourceRow>(
      articleSelectionSql(schema),
      [sourceTicker.id],
    );
    const placementResult = await pool.query<SourceRow>(
      `SELECT * FROM ${quoteIdentifier(schema)}.data_source_ticker_section WHERE ticker_id = $1`,
      [sourceTicker.id],
    );

    const articles =
      options.limit === undefined
        ? articleResult.rows
        : articleResult.rows.slice(0, options.limit);
    const keptArticleIds = new Set(articles.map((row) => asText(row.id)));
    const placements = placementResult.rows.filter((row) =>
      keptArticleIds.has(asText(row.data_source_id)),
    );
    const provenanceNulled = articles.filter(
      (row) =>
        remapTickerId(asText(row.ticker_id), sourceTicker.id, local.id) ===
        null,
    ).length;

    const result: PullTickerLocalResult = {
      symbol: options.symbol,
      sourceTickerId: sourceTicker.id,
      localTickerId: local.id,
      profilesWritten: 0,
      articlesWritten: 0,
      placementsWritten: 0,
      provenanceNulled,
      applied: options.apply,
    };

    if (!options.apply) {
      console.log(
        `Dry run: would write ${profileResult.rows.length} profile, ${articles.length} articles, ${placements.length} placements. Pass --apply to write.`,
      );

      return result;
    }

    for (const row of profileResult.rows) {
      const fields = {
        companyOverview: asText(row.company_overview) ?? "",
        businessOperation: asText(row.business_operation) ?? "",
        sectorIndonesian: asText(row.sector_indonesian) ?? "",
        sectorEnglish: asText(row.sector_english) ?? "",
        subSectorIndonesian: asText(row.sub_sector_indonesian) ?? "",
        subSectorEnglish: asText(row.sub_sector_english) ?? "",
        industryIndonesian: asText(row.industry_indonesian) ?? "",
        industryEnglish: asText(row.industry_english) ?? "",
        subIndustryIndonesian: asText(row.sub_industry_indonesian) ?? "",
        subIndustryEnglish: asText(row.sub_industry_english) ?? "",
        aliases: Array.isArray(row.aliases) ? (row.aliases as string[]) : [],
        competitors: row.competitors ?? [],
        regulators: row.regulators ?? [],
      };
      await targetDb.tickerProfile.upsert({
        where: { tickerId: local.id },
        create: { tickerId: local.id, ...fields },
        update: fields,
      });
      result.profilesWritten += 1;
    }

    for (const chunk of chunked(articles, PULL_CHUNK_SIZE)) {
      for (const row of chunk) {
        await targetDb.dataSource.upsert(
          toDataSourceUpsert(row, local.id, sourceTicker.id),
        );
        result.articlesWritten += 1;
      }
    }

    for (const chunk of chunked(placements, PULL_CHUNK_SIZE)) {
      for (const row of chunk) {
        await targetDb.dataSourceTickerSection.upsert(
          toPlacementUpsert(row, local.id),
        );
        result.placementsWritten += 1;
      }
    }

    return result;
  } finally {
    await pool.end();
  }
};

/**
 * Loads Mediapulse env for CLI execution (`packages/mediapulse/env/.env`).
 */
const loadMediapulseScriptEnv = (): string => {
  const envPath = path.resolve(__dirname, "../../env/.env");
  if (!fs.existsSync(envPath)) {
    console.error(
      `Expected ${envPath} (copy from env.example and set MEDIAPULSE_DATABASE_URL).`,
    );
    process.exit(1);
  }

  config({ path: envPath });
  console.log(`Loading environment variables from ${envPath}`);

  return envPath;
};

const flagValue = (name: string): string | undefined => {
  const prefixed = `--${name}`;
  const index = process.argv.indexOf(prefixed);
  if (index !== -1) {
    return process.argv[index + 1];
  }
  const inline = process.argv.find((argument) =>
    argument.startsWith(`${prefixed}=`),
  );

  return inline?.slice(prefixed.length + 1);
};

const isLocalHost = (url: string): boolean => {
  try {
    const host = new URL(url).hostname;

    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return false;
  }
};

const main = async (): Promise<void> => {
  loadMediapulseScriptEnv();

  const symbol = flagValue("symbol");
  const sourceUrl = flagValue("source-url");
  const limitFlag = flagValue("limit");
  const apply = process.argv.includes("--apply");

  if (symbol === undefined || sourceUrl === undefined) {
    console.error(
      'Usage: pull-ticker-local --symbol FORE --source-url "postgresql://..." [--source-schema mediapulse] [--limit 100] [--apply]',
    );
    process.exit(1);
  }
  if (isLocalHost(sourceUrl)) {
    console.error(
      "--source-url points at localhost. This script pulls from a remote database into the local one.",
    );
    process.exit(1);
  }

  // The local client reads MEDIAPULSE_DATABASE_URL, and every app and migration in the repo shares
  // that value through a symlink. Writing into a remote database from here would be a surprise.
  const localUrl = (await import("@mediapulse/env")).env
    .MEDIAPULSE_DATABASE_URL;
  if (!isLocalHost(localUrl)) {
    console.error(
      "MEDIAPULSE_DATABASE_URL is not local. Refusing to write pulled rows into a remote database.",
    );
    process.exit(1);
  }

  const result = await pullTickerLocal({
    symbol,
    sourceUrl,
    sourceSchema: flagValue("source-schema"),
    apply,
    limit: limitFlag === undefined ? undefined : Number.parseInt(limitFlag, 10),
  });

  console.log(
    `${result.symbol}: sourceTickerId=${result.sourceTickerId} localTickerId=${result.localTickerId}`,
  );
  console.log(
    `Wrote ${result.profilesWritten} profile, ${result.articlesWritten} articles, ${result.placementsWritten} placements.`,
  );
  if (result.provenanceNulled > 0) {
    console.log(
      `Nulled cross-ticker provenance on ${result.provenanceNulled} articles (collected for another issuer, kept for their Placement).`,
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
      console.error("Failed to pull ticker data", error);
      process.exit(1);
    });
}
