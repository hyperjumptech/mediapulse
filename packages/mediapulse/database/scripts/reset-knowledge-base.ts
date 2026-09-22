import fs from "fs";
import { Pool } from "pg";

export const DATA_TABLES = [
  "knowledge_entity_mention",
  "knowledge_ticker_relation",
  "knowledge_relation",
  "knowledge_ticker_entity",
  "knowledge_entity_alias",
  "knowledge_entity",
] as const;

export type ResetKnowledgeBaseResult = {
  applied: boolean;
  deleted: Record<string, number>;
  inventedKindsDeleted: number;
  inventedKindAliasesDeleted: number;
  watermarksCleared: number;
  curatedKindsKept: number;
  runsKept: number;
};

const quoteIdentifier = (value: string): string =>
  `"${value.replace(/"/gu, '""')}"`;

export const countSql = (schema: string, table: string): string =>
  `SELECT count(*)::int AS n FROM ${quoteIdentifier(schema)}.${quoteIdentifier(table)}`;

export const deleteInventedKindAliasesSql = (schema: string): string => `
  DELETE FROM ${quoteIdentifier(schema)}.knowledge_relation_kind_alias a
  USING ${quoteIdentifier(schema)}.knowledge_relation_kind k
  WHERE a.kind_slug = k.slug AND k.curated = false
`;

export const deleteInventedKindsSql = (schema: string): string =>
  `DELETE FROM ${quoteIdentifier(schema)}.knowledge_relation_kind WHERE curated = false`;

export const clearWatermarksSql = (schema: string): string =>
  `UPDATE ${quoteIdentifier(schema)}.knowledge_extraction_run SET watermark_at = NULL WHERE watermark_at IS NOT NULL`;

const schemaFromUrl = (sourceUrl: string): string =>
  new URL(sourceUrl).searchParams.get("schema") ?? "mediapulse";

const flagValue = (name: string): string | undefined => {
  const prefixed = `--${name}`;
  const index = process.argv.indexOf(prefixed);
  if (index !== -1) {
    return process.argv[index + 1];
  }

  return process.argv
    .find((argument) => argument.startsWith(`${prefixed}=`))
    ?.slice(prefixed.length + 1);
};

export const resetKnowledgeBase = async (options: {
  sourceUrl: string;
  apply: boolean;
  sourceSchema?: string;
}): Promise<ResetKnowledgeBaseResult> => {
  const schema = options.sourceSchema ?? schemaFromUrl(options.sourceUrl);
  const pool = new Pool({ connectionString: options.sourceUrl, max: 2 });

  try {
    const deleted: Record<string, number> = {};
    for (const table of DATA_TABLES) {
      const rows = await pool.query(countSql(schema, table));
      deleted[table] = Number(rows.rows[0]?.n ?? 0);
    }

    const invented = await pool.query(
      `SELECT count(*)::int AS n FROM ${quoteIdentifier(schema)}.knowledge_relation_kind WHERE curated = false`,
    );
    const curated = await pool.query(
      `SELECT count(*)::int AS n FROM ${quoteIdentifier(schema)}.knowledge_relation_kind WHERE curated = true`,
    );
    const runs = await pool.query(countSql(schema, "knowledge_extraction_run"));
    const watermarked = await pool.query(
      `SELECT count(*)::int AS n FROM ${quoteIdentifier(schema)}.knowledge_extraction_run WHERE watermark_at IS NOT NULL`,
    );

    const result: ResetKnowledgeBaseResult = {
      applied: false,
      deleted,
      inventedKindsDeleted: Number(invented.rows[0]?.n ?? 0),
      inventedKindAliasesDeleted: 0,
      watermarksCleared: Number(watermarked.rows[0]?.n ?? 0),
      curatedKindsKept: Number(curated.rows[0]?.n ?? 0),
      runsKept: Number(runs.rows[0]?.n ?? 0),
    };

    if (!options.apply) {
      return result;
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const table of DATA_TABLES) {
        await client.query(
          `DELETE FROM ${quoteIdentifier(schema)}.${quoteIdentifier(table)}`,
        );
      }
      const aliases = await client.query(deleteInventedKindAliasesSql(schema));
      await client.query(deleteInventedKindsSql(schema));
      await client.query(clearWatermarksSql(schema));
      await client.query("COMMIT");
      result.inventedKindAliasesDeleted = aliases.rowCount ?? 0;
    } catch (error) {
      await client.query("ROLLBACK");

      throw error;
    } finally {
      client.release();
    }

    return { ...result, applied: true };
  } finally {
    await pool.end();
  }
};

const main = async (): Promise<void> => {
  const sourceUrlFile = flagValue("source-url-file");
  const sourceUrl =
    sourceUrlFile === undefined
      ? flagValue("source-url")
      : fs.readFileSync(sourceUrlFile, "utf8").trim();

  if (sourceUrl === undefined) {
    throw new Error(
      "Pass --source-url <url> or --source-url-file <path>, and --apply to write",
    );
  }

  const result = await resetKnowledgeBase({
    sourceUrl,
    apply: process.argv.includes("--apply"),
  });

  for (const [table, rows] of Object.entries(result.deleted)) {
    process.stdout.write(`${String(rows).padStart(7)}  ${table}\n`);
  }
  process.stdout.write(
    `${String(result.inventedKindsDeleted).padStart(7)}  knowledge_relation_kind (uncurated)\n`,
  );
  process.stdout.write(
    `Keeping ${String(result.curatedKindsKept)} curated kinds and ${String(result.runsKept)} extraction runs; clearing ${String(result.watermarksCleared)} watermarks.\n`,
  );
  process.stdout.write(
    result.applied
      ? `Applied. Removed ${String(result.inventedKindAliasesDeleted)} aliases of uncurated kinds.\n`
      : "Dry run. Pass --apply to delete.\n",
  );
};

if (process.argv[1] === new URL(import.meta.url).pathname) {
  void main();
}
