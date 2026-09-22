import fs from "node:fs";
import path from "node:path";

import { extractEntityRelations } from "../apps/mediapulse/agents/knowledge-ingestion/src/lib/extract-entity-relations.js";
import { extractionArticleText } from "../apps/mediapulse/agents/knowledge-ingestion/src/lib/build-extraction-messages.js";
import { slugForPhrase } from "../apps/mediapulse/agents/knowledge-ingestion/src/lib/knowledge-kinds.js";
import {
  PROMPT_VARIANTS,
  MARKET_PARTY_KINDS,
} from "../apps/mediapulse/agents/knowledge-ingestion/src/lib/prompt-variants.js";
import { normalizeEntityName } from "../packages/shared/utils/src/market-party-names.js";

const DEFAULT_MODELS = [
  "openai/gpt-4o-mini",
  "openai/gpt-4.1-nano",
  "openai/gpt-5-nano",
  "google/gemini-2.5-flash-lite",
  "qwen/qwen3-30b-a3b-instruct-2507",
  "mistralai/mistral-small-3.2-24b-instruct",
  "meta-llama/llama-3.3-70b-instruct",
  "z-ai/glm-4.7-flash",
  "openai/gpt-4.1-mini",
];

const CURATED_SLUGS = new Set([
  "competes_with",
  "regulates",
  "supplies",
  "distributes_for",
  "partners_with",
  "owns_stake_in",
  "subsidiary_of",
  "operates_brand",
  "is_a_subsidiary_of",
  "operates_the_brand",
  "owns_a_stake_in",
  "is_regulated_by",
  "is_owned_by",
]);

const flagValue = (name) => {
  const prefixed = `--${name}`;
  const index = process.argv.indexOf(prefixed);
  if (index !== -1) {
    return process.argv[index + 1];
  }

  return process.argv
    .find((argument) => argument.startsWith(`${prefixed}=`))
    ?.slice(prefixed.length + 1);
};

const readKey = () => {
  const file = flagValue("api-key-file");
  if (file !== undefined) {
    return fs.readFileSync(file, "utf8").trim();
  }
  const value = process.env.OPENROUTER_API_KEY;
  if (value === undefined || value.trim() === "") {
    throw new Error("Pass --api-key-file <path> or set OPENROUTER_API_KEY");
  }

  return value;
};

const mapWithConcurrency = async (items, limit, worker) => {
  const results = new Array(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, () =>
    (async () => {
      for (;;) {
        const index = next;
        next += 1;
        if (index >= items.length) {
          return;
        }
        results[index] = await worker(items[index], index);
      }
    })(),
  );
  await Promise.all(runners);

  return results;
};

const fetchPricing = async (models) => {
  const response = await fetch("https://openrouter.ai/api/v1/models");
  const body = await response.json();
  const prices = {};
  for (const model of models) {
    const row = body.data.find((entry) => entry.id === model);
    prices[model] =
      row === undefined
        ? { input: 0, output: 0 }
        : {
            input: Number.parseFloat(row.pricing.prompt) * 1e6,
            output: Number.parseFloat(row.pricing.completion) * 1e6,
          };
  }

  return prices;
};

const runOne = async ({
  article,
  issuer,
  variant,
  variantKey,
  model,
  apiKey,
  baseUrl,
  vocabulary,
}) => {
  const articleText = extractionArticleText(article);
  const started = Date.now();
  const base = {
    model,
    variant: variantKey,
    symbol: issuer.symbol,
    dataSourceId: article.dataSourceId,
    hasBody: article.content !== null && article.content.length > 400,
  };

  if (articleText.trim().length === 0) {
    return { ...base, status: "empty" };
  }

  try {
    const outcome = await extractEntityRelations({
      article,
      issuer,
      candidates: issuer.parties,
      relationKindLabels: vocabulary,
      llm: { model, apiKey, baseUrl },
      buildMessagesFn: variant.build,
      schema: variant.schema,
    });

    const rejections = {};
    for (const rejection of outcome.rejections) {
      rejections[rejection.reason] = (rejections[rejection.reason] ?? 0) + 1;
    }

    return {
      ...base,
      status: "ok",
      latencyMs: Date.now() - started,
      inputTokens: outcome.usage?.inputTokens ?? 0,
      outputTokens: outcome.usage?.outputTokens ?? 0,
      emittedEntities:
        outcome.entities.length +
        (rejections["span-not-in-text"] ?? 0) +
        (rejections["name-not-in-text"] ?? 0),
      emittedRelations:
        outcome.relations.length +
        (rejections["endpoint-unknown"] ?? 0) +
        (rejections["self-relation"] ?? 0),
      rejections,
      entities: outcome.entities.map((entity) => ({
        name: entity.name,
        normalized: normalizeEntityName(entity.name),
        kind: entity.kind,
      })),
      relations: outcome.relations.map((relation) => ({
        subject: normalizeEntityName(relation.subject),
        object: normalizeEntityName(relation.object),
        slug: slugForPhrase(relation.kind),
      })),
    };
  } catch (error) {
    return {
      ...base,
      status: "error",
      latencyMs: Date.now() - started,
      message: String(error?.message ?? error).slice(0, 200),
    };
  }
};

const runBench = async () => {
  const samplePath = flagValue("sample");
  const outPath = flagValue("out");
  if (samplePath === undefined || outPath === undefined) {
    throw new Error("Pass --sample <path> and --out <path>");
  }

  const sample = JSON.parse(fs.readFileSync(samplePath, "utf8"));
  const models = (flagValue("models") ?? DEFAULT_MODELS.join(",")).split(",");
  const variantKeys = (
    flagValue("variants") ?? Object.keys(PROMPT_VARIANTS).join(",")
  ).split(",");
  const concurrency = Number.parseInt(flagValue("concurrency") ?? "8", 10);
  const limit = flagValue("limit");
  const apiKey = readKey();
  const baseUrl =
    process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1";

  const issuers = new Map(
    sample.issuers.map((issuer) => [issuer.symbol, issuer]),
  );
  const articles =
    limit === undefined
      ? sample.articles
      : sample.articles.slice(0, Number.parseInt(limit, 10));

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const done = new Set();
  if (fs.existsSync(outPath)) {
    for (const line of fs.readFileSync(outPath, "utf8").split("\n")) {
      if (line.trim() === "") {
        continue;
      }
      const row = JSON.parse(line);
      done.add(`${row.model}|${row.variant}|${row.dataSourceId}`);
    }
  }

  const jobs = [];
  for (const model of models) {
    for (const variantKey of variantKeys) {
      for (const article of articles) {
        if (done.has(`${model}|${variantKey}|${article.dataSourceId}`)) {
          continue;
        }
        jobs.push({ model, variantKey, article });
      }
    }
  }

  process.stdout.write(
    `${String(jobs.length)} calls: ${String(models.length)} models x ${String(variantKeys.length)} variants x ${String(articles.length)} articles (${String(done.size)} already done)\n`,
  );

  const stream = fs.createWriteStream(outPath, { flags: "a" });
  let finished = 0;

  await mapWithConcurrency(jobs, concurrency, async (job) => {
    const variant = PROMPT_VARIANTS[job.variantKey];
    const issuer = issuers.get(job.article.symbol);
    const vocabulary =
      variant.vocabulary === "curated"
        ? sample.curatedKindLabels
        : sample.observedKindLabels;

    const row = await runOne({
      article: job.article,
      issuer: { ...issuer, aliases: issuer.aliases ?? [] },
      variant,
      variantKey: job.variantKey,
      model: job.model,
      apiKey,
      baseUrl,
      vocabulary,
    });

    stream.write(`${JSON.stringify(row)}\n`);
    finished += 1;
    if (finished % 25 === 0) {
      process.stdout.write(`  ${String(finished)}/${String(jobs.length)}\n`);
    }
  });

  await new Promise((resolve) => stream.end(resolve));
  process.stdout.write(`done -> ${outPath}\n`);
};

const pct = (numerator, denominator) =>
  denominator === 0 ? "-" : `${((numerator / denominator) * 100).toFixed(1)}%`;

const report = async () => {
  const inPath = flagValue("in");
  if (inPath === undefined) {
    throw new Error("Pass --in <jsonl>");
  }
  const rows = fs
    .readFileSync(inPath, "utf8")
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => JSON.parse(line));

  const models = [...new Set(rows.map((row) => row.model))];
  const prices = await fetchPricing(models);

  const personLexicon = new Set();
  const byNameModels = new Map();
  for (const row of rows) {
    if (row.status !== "ok" || row.variant !== "v0-legacy") {
      continue;
    }
    for (const entity of row.entities) {
      if (entity.kind !== "person") {
        continue;
      }
      const seen = byNameModels.get(entity.normalized) ?? new Set();
      seen.add(row.model);
      byNameModels.set(entity.normalized, seen);
    }
  }
  for (const [name, seen] of byNameModels) {
    if (seen.size >= 3) {
      personLexicon.add(name);
    }
  }

  const consensus = new Map();
  for (const row of rows) {
    if (row.status !== "ok") {
      continue;
    }
    for (const entity of row.entities) {
      const key = `${row.dataSourceId}|${entity.normalized}`;
      const seen = consensus.get(key) ?? new Set();
      seen.add(row.model);
      consensus.set(key, seen);
    }
  }
  const corroborated = new Set();
  for (const [key, seen] of consensus) {
    if (seen.size >= 3) {
      corroborated.add(key);
    }
  }
  const corroboratedMarketParties = new Set(
    [...corroborated].filter((key) => {
      const name = key.slice(key.indexOf("|") + 1);

      return !personLexicon.has(name);
    }),
  );
  const corroboratedByArticle = new Map();
  for (const key of corroborated) {
    const [dataSourceId] = key.split("|");
    corroboratedByArticle.set(
      dataSourceId,
      (corroboratedByArticle.get(dataSourceId) ?? 0) + 1,
    );
  }

  const groups = new Map();
  for (const row of rows) {
    const key = `${row.model}|${row.variant}`;
    const group = groups.get(key) ?? {
      model: row.model,
      variant: row.variant,
      calls: 0,
      errors: 0,
      emittedEntities: 0,
      emittedRelations: 0,
      spanReject: 0,
      nameReject: 0,
      endpointUnknown: 0,
      keptEntities: 0,
      keptRelations: 0,
      marketParty: 0,
      persons: 0,
      offVocab: 0,
      corroboratedHits: 0,
      recallHits: 0,
      recallTotal: 0,
      latency: [],
      inputTokens: 0,
      outputTokens: 0,
      articles: new Set(),
    };

    group.calls += 1;
    if (row.status === "error") {
      group.errors += 1;
      groups.set(key, group);

      continue;
    }
    if (row.status !== "ok") {
      groups.set(key, group);

      continue;
    }

    group.articles.add(row.dataSourceId);
    group.latency.push(row.latencyMs);
    group.inputTokens += row.inputTokens;
    group.outputTokens += row.outputTokens;
    group.emittedEntities += row.emittedEntities;
    group.emittedRelations += row.emittedRelations;
    group.spanReject += row.rejections["span-not-in-text"] ?? 0;
    group.nameReject += row.rejections["name-not-in-text"] ?? 0;
    group.endpointUnknown += row.rejections["endpoint-unknown"] ?? 0;
    group.keptEntities += row.entities.length;
    group.keptRelations += row.relations.length;

    for (const entity of row.entities) {
      if (MARKET_PARTY_KINDS.includes(entity.kind)) {
        group.marketParty += 1;
      }
      if (entity.kind === "person" || personLexicon.has(entity.normalized)) {
        group.persons += 1;
      }
      if (corroborated.has(`${row.dataSourceId}|${entity.normalized}`)) {
        group.corroboratedHits += 1;
      }
    }
    for (const relation of row.relations) {
      if (relation.slug === null || !CURATED_SLUGS.has(relation.slug)) {
        group.offVocab += 1;
      }
    }

    const found = new Set(row.entities.map((entity) => entity.normalized));
    for (const key2 of corroboratedMarketParties) {
      const [dataSourceId, name] = key2.split("|");
      if (dataSourceId !== row.dataSourceId) {
        continue;
      }
      group.recallTotal += 1;
      if (found.has(name)) {
        group.recallHits += 1;
      }
    }

    groups.set(key, group);
  }

  const summary = [...groups.values()].map((group) => {
    const price = prices[group.model] ?? { input: 0, output: 0 };
    const cost =
      (group.inputTokens / 1e6) * price.input +
      (group.outputTokens / 1e6) * price.output;
    const articles = group.articles.size || 1;
    const median =
      group.latency.length === 0
        ? 0
        : [...group.latency].sort((a, b) => a - b)[
            Math.floor(group.latency.length / 2)
          ];

    return {
      model: group.model,
      variant: group.variant,
      err: group.errors,
      entPerArt: (group.keptEntities / articles).toFixed(1),
      relPerArt: (group.keptRelations / articles).toFixed(1),
      person: pct(group.persons, group.keptEntities),
      market: pct(group.marketParty, group.keptEntities),
      fabricated: pct(
        group.spanReject,
        group.emittedEntities + group.emittedRelations,
      ),
      nameReject: pct(
        group.nameReject,
        group.emittedEntities + group.emittedRelations,
      ),
      offVocab: pct(group.offVocab, group.keptRelations),
      precision: pct(group.corroboratedHits, group.keptEntities),
      recall: pct(group.recallHits, group.recallTotal),
      medianMs: median,
      costPer1k: `$${((cost / articles) * 1000).toFixed(2)}`,
    };
  });

  summary.sort(
    (a, b) =>
      a.variant.localeCompare(b.variant) || a.model.localeCompare(b.model),
  );

  const byVariant = new Map();
  for (const group of groups.values()) {
    const roll = byVariant.get(group.variant) ?? {
      variant: group.variant,
      keptEntities: 0,
      keptRelations: 0,
      marketParty: 0,
      persons: 0,
      offVocab: 0,
      spanReject: 0,
      emitted: 0,
      corroboratedHits: 0,
      recallHits: 0,
      recallTotal: 0,
      errors: 0,
      articles: 0,
    };
    roll.keptEntities += group.keptEntities;
    roll.keptRelations += group.keptRelations;
    roll.marketParty += group.marketParty;
    roll.persons += group.persons;
    roll.offVocab += group.offVocab;
    roll.spanReject += group.spanReject;
    roll.emitted += group.emittedEntities + group.emittedRelations;
    roll.corroboratedHits += group.corroboratedHits;
    roll.recallHits += group.recallHits;
    roll.recallTotal += group.recallTotal;
    roll.errors += group.errors;
    roll.articles += group.articles.size;
    byVariant.set(group.variant, roll);
  }

  const variantTable = [...byVariant.values()]
    .map((roll) => ({
      variant: roll.variant,
      entPerArt: (roll.keptEntities / (roll.articles || 1)).toFixed(2),
      relPerArt: (roll.keptRelations / (roll.articles || 1)).toFixed(2),
      person: pct(roll.persons, roll.keptEntities),
      market: pct(roll.marketParty, roll.keptEntities),
      fabricated: pct(roll.spanReject, roll.emitted),
      offVocab: pct(roll.offVocab, roll.keptRelations),
      precision: pct(roll.corroboratedHits, roll.keptEntities),
      recall: pct(roll.recallHits, roll.recallTotal),
      errors: roll.errors,
    }))
    .sort((a, b) => a.variant.localeCompare(b.variant));

  const slugCounts = new Map();
  for (const row of rows) {
    if (row.status !== "ok") {
      continue;
    }
    for (const relation of row.relations) {
      if (relation.slug === null || CURATED_SLUGS.has(relation.slug)) {
        continue;
      }
      const key = `${row.variant}|${relation.slug}`;
      slugCounts.set(key, (slugCounts.get(key) ?? 0) + 1);
    }
  }
  const byVariantSlugs = new Map();
  for (const [key, count] of slugCounts) {
    const [variant, slug] = key.split("|");
    const list = byVariantSlugs.get(variant) ?? [];
    list.push({ slug, count });
    byVariantSlugs.set(variant, list);
  }
  for (const [variant, list] of [...byVariantSlugs].sort()) {
    const top = list
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map((entry) => `${entry.slug}:${String(entry.count)}`)
      .join(" ");
    process.stdout.write(
      `${variant} invented kinds (${String(list.length)} distinct): ${top}\n`,
    );
  }
  process.stdout.write("\n");

  process.stdout.write("Across all models, by prompt variant:\n");
  console.table(variantTable);
  process.stdout.write("\nBy model and variant:\n");

  process.stdout.write(
    `person lexicon: ${String(personLexicon.size)} names agreed by 3+ models\n`,
  );
  process.stdout.write(
    `corroborated entities: ${String(corroborated.size)} across ${String(corroboratedByArticle.size)} articles, ${String(corroboratedMarketParties.size)} of them market parties\n\n`,
  );
  console.table(summary);
};

const main = async () => {
  if (process.argv.includes("--report")) {
    await report();

    return;
  }

  await runBench();
};

void main();
