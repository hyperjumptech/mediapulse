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
  SELECT t.id, t.symbol, t.name,
         issuer_aliases.aliases AS issuer_aliases,
         issuer.description AS company_overview
  FROM ${quoteIdentifier(schema)}.ticker t
  LEFT JOIN ${quoteIdentifier(schema)}.knowledge_entity issuer
    ON issuer.ticker_id = t.id
  LEFT JOIN LATERAL (
    SELECT array_agg(alias.alias ORDER BY alias.alias) AS aliases
    FROM ${quoteIdentifier(schema)}.knowledge_entity_alias alias
    WHERE alias.entity_id = issuer.id
  ) issuer_aliases ON true
  WHERE t.symbol = ANY($1)
`;

export const seededPartySql = (schema: string): string => `
  SELECT link.ticker_id, entity.kind::text AS kind,
         entity.canonical_name AS name,
         COALESCE(
           array_agg(alias.alias ORDER BY alias.alias)
             FILTER (WHERE alias.alias IS NOT NULL),
           '{}'
         ) AS aliases
  FROM ${quoteIdentifier(schema)}.knowledge_ticker_entity link
  JOIN ${quoteIdentifier(schema)}.knowledge_entity entity
    ON entity.id = link.entity_id
  LEFT JOIN ${quoteIdentifier(schema)}.knowledge_entity_alias alias
    ON alias.entity_id = entity.id
  WHERE link.ticker_id = ANY($1)
    AND link.source = 'profile'
    AND link.is_issuer = false
    AND entity.kind IN ('company', 'regulator')
  GROUP BY link.ticker_id, entity.id, entity.kind, entity.canonical_name
  ORDER BY entity.kind, entity.canonical_name
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

export const toSampleParties = (
  rows: readonly {
    ticker_id: unknown;
    kind: unknown;
    name: unknown;
    aliases: unknown;
  }[],
  tickerId: string,
): SampleParty[] =>
  rows.flatMap((row) => {
    if (String(row.ticker_id) !== tickerId) {
      return [];
    }
    if (row.kind !== "company" && row.kind !== "regulator") {
      return [];
    }
    if (typeof row.name !== "string" || row.name.trim() === "") {
      return [];
    }
    const aliases = Array.isArray(row.aliases)
      ? row.aliases.filter(
          (alias): alias is string => typeof alias === "string",
        )
      : [];

    return [{ name: row.name, aliases, kind: row.kind }];
  });

export const toSampleIssuer = (
  row: {
    id: unknown;
    symbol: unknown;
    name: unknown;
    issuer_aliases?: unknown;
    company_overview?: unknown;
  },
  parties: SampleParty[],
): SampleIssuer => ({
  tickerId: String(row.id),
  symbol: String(row.symbol),
  name: String(row.name),
  aliases: Array.isArray(row.issuer_aliases)
    ? row.issuer_aliases.filter(
        (alias): alias is string => typeof alias === "string",
      )
    : [],
  companyOverview:
    row.company_overview === null || row.company_overview === undefined
      ? null
      : String(row.company_overview),
  parties,
});

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

    const tickerIds = issuerRows.rows.map((row) => String(row.id));
    const partyRows = await pool.query(seededPartySql(schema), [tickerIds]);

    const issuers: SampleIssuer[] = issuerRows.rows.map((row) =>
      toSampleIssuer(row, toSampleParties(partyRows.rows, String(row.id))),
    );

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
