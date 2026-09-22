import fs from "fs";
import path from "path";
import { Pool } from "pg";

export const DEFAULT_SYMBOLS = ["FORE", "ACES", "TLKM", "SOHO", "ANTM"];
export const DEFAULT_PER_SYMBOL = 6;

export type SampleParty = {
  name: string;
  aliases: string[];
  kind: "company" | "regulator";
};

export type SampleIssuer = {
  tickerId: string;
  symbol: string;
  name: string;
  aliases: string[];
  companyOverview: string | null;
  parties: SampleParty[];
};

export type SampleArticle = {
  dataSourceId: string;
  symbol: string;
  title: string;
  description: string | null;
  content: string | null;
};

export type KnowledgeArticleSample = {
  generatedAt: string;
  symbols: string[];
  perSymbol: number;
  issuers: SampleIssuer[];
  curatedKindLabels: string[];
  observedKindLabels: string[];
  articles: SampleArticle[];
};

const quoteIdentifier = (value: string): string =>
  `"${value.replace(/"/gu, '""')}"`;

export const issuerSelectionSql = (schema: string): string => `
  SELECT t.id, t.symbol, t.name, t.aliases AS ticker_aliases,
         p.aliases AS profile_aliases, p.company_overview,
         p.competitors, p.regulators
  FROM ${quoteIdentifier(schema)}.ticker t
  LEFT JOIN ${quoteIdentifier(schema)}.ticker_profile p ON p.ticker_id = t.id
  WHERE t.symbol = ANY($1)
`;

export const articleSampleSql = (schema: string, bodyOnly: boolean): string => `
  SELECT ds.id, ds.title, ds.description, ds.content
  FROM ${quoteIdentifier(schema)}.data_source ds
  WHERE ds.id IN (
    SELECT s.data_source_id
    FROM ${quoteIdentifier(schema)}.data_source_ticker_section s
    WHERE s.ticker_id = $1 AND s.section IS NOT NULL
  )
  AND ds.title IS NOT NULL
  ${bodyOnly ? "AND ds.content IS NOT NULL AND length(ds.content) > 400" : ""}
  ORDER BY md5(ds.id || $3::text)
  LIMIT $2
`;

export const asParties = (
  value: unknown,
  kind: SampleParty["kind"],
): SampleParty[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (typeof entry !== "object" || entry === null) {
      return [];
    }
    const record = entry as { name?: unknown; aliases?: unknown };
    if (typeof record.name !== "string" || record.name.trim() === "") {
      return [];
    }
    const aliases = Array.isArray(record.aliases)
      ? record.aliases.filter(
          (alias): alias is string => typeof alias === "string",
        )
      : [];

    return [{ name: record.name, aliases, kind }];
  });
};

const schemaFromUrl = (sourceUrl: string): string => {
  const parsed = new URL(sourceUrl);

  return parsed.searchParams.get("schema") ?? "mediapulse";
};

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

export const sampleKnowledgeArticles = async (options: {
  sourceUrl: string;
  symbols: string[];
  perSymbol: number;
  seed: string;
  sourceSchema?: string;
}): Promise<KnowledgeArticleSample> => {
  const schema = options.sourceSchema ?? schemaFromUrl(options.sourceUrl);
  const pool = new Pool({ connectionString: options.sourceUrl, max: 3 });

  try {
    const issuerRows = await pool.query(issuerSelectionSql(schema), [
      options.symbols,
    ]);

    const issuers: SampleIssuer[] = issuerRows.rows.map((row) => ({
      tickerId: String(row.id),
      symbol: String(row.symbol),
      name: String(row.name),
      aliases: (row.profile_aliases ?? row.ticker_aliases ?? []) as string[],
      companyOverview:
        row.company_overview === null || row.company_overview === undefined
          ? null
          : String(row.company_overview),
      parties: [
        ...asParties(row.competitors, "company"),
        ...asParties(row.regulators, "regulator"),
      ],
    }));

    const articles: SampleArticle[] = [];
    const seen = new Set<string>();
    for (const issuer of issuers) {
      for (const bodyOnly of [true, false]) {
        const rows = await pool.query(articleSampleSql(schema, bodyOnly), [
          issuer.tickerId,
          options.perSymbol,
          options.seed,
        ]);
        for (const row of rows.rows) {
          const dataSourceId = String(row.id);
          if (seen.has(dataSourceId)) {
            continue;
          }
          seen.add(dataSourceId);
          articles.push({
            dataSourceId,
            symbol: issuer.symbol,
            title: String(row.title),
            description:
              row.description === null || row.description === undefined
                ? null
                : String(row.description),
            content:
              row.content === null || row.content === undefined
                ? null
                : String(row.content),
          });
        }
      }
    }

    const kindRows = await pool.query(
      `SELECT label, curated, observations
       FROM ${quoteIdentifier(schema)}.knowledge_relation_kind
       ORDER BY curated DESC, observations DESC
       LIMIT 40`,
    );

    return {
      generatedAt: new Date().toISOString(),
      symbols: options.symbols,
      perSymbol: options.perSymbol,
      issuers,
      curatedKindLabels: kindRows.rows
        .filter((row) => row.curated === true)
        .map((row) => String(row.label)),
      observedKindLabels: kindRows.rows.map((row) => String(row.label)),
      articles,
    };
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
  const out = flagValue("out");

  if (sourceUrl === undefined || out === undefined) {
    throw new Error(
      "Pass --source-url <url> (or --source-url-file <path>) and --out <path>",
    );
  }

  const symbolsFlag = flagValue("symbols");
  const perSymbolFlag = flagValue("per-symbol");

  const sample = await sampleKnowledgeArticles({
    sourceUrl,
    symbols:
      symbolsFlag === undefined ? DEFAULT_SYMBOLS : symbolsFlag.split(","),
    perSymbol:
      perSymbolFlag === undefined
        ? DEFAULT_PER_SYMBOL
        : Number.parseInt(perSymbolFlag, 10),
    seed: flagValue("seed") ?? "kb-bench-1",
  });

  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(sample, null, 2));

  const withContent = sample.articles.filter(
    (article) => article.content !== null && article.content.length > 0,
  ).length;
  process.stdout.write(
    `${String(sample.issuers.length)} issuers, ${String(sample.articles.length)} articles (${String(withContent)} with body), ${String(sample.curatedKindLabels.length)} curated kinds, ${String(sample.observedKindLabels.length)} observed kinds -> ${out}\n`,
  );
};

if (process.argv[1] === new URL(import.meta.url).pathname) {
  void main();
}
