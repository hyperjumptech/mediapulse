import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

import { newsletterExclusionOf } from "../apps/mediapulse/agents/content-generation/src/lib/newsletter-excluded-url.js";
import { expandSourceUrl } from "../apps/mediapulse/agents/page-collection/src/utilities/expand-source-urls.js";
import {
  RateLimiter,
  expandFetchProviderEntries,
  performWebFetch,
  runQualityGate,
} from "../packages/shared/agent-ingestion/src/index.js";
import { isUnresolvableAggregatorUrl } from "../packages/shared/utils/src/index.js";
import {
  FEED_CANDIDATES,
  SERPER_OUTAGE,
  TARGET_DOMAINS,
  VARIANTS,
  articleMatch,
  cellKey,
  contentMatch,
  markdownToText,
  feedStats,
  isUsable,
  newestFirst,
  pickCorpus,
  renderReport,
  summarize,
  variantUrls,
  wordCount,
} from "./lib/fetch-domains-eval.mjs";
import { requireEnv } from "./lib/summarizer-eval.mjs";

const requireFromDatabase = createRequire(
  new URL("../packages/mediapulse/database/package.json", import.meta.url),
);
const { Client } = requireFromDatabase("pg");

const OUT_DIR = fileURLToPath(
  new URL("../.eval-cache/fetch-domains", import.meta.url),
);
const RESULTS_PATH = `${OUT_DIR}/results.jsonl`;
const FEEDS_PATH = `${OUT_DIR}/feeds.jsonl`;
const FEEDS_REPORT_PATH = `${OUT_DIR}/feeds.md`;
const DISCOVERY_TIMEOUT_MS = 30_000;
const CORPUS_PATH = `${OUT_DIR}/corpus.json`;
const REPORT_PATH = `${OUT_DIR}/report.md`;
const SERPER_SCRAPE_URL = "https://scrape.serper.dev";
const REQUEST_GAP_MS = 500;
const TIMEOUT_MS = 45_000;
const EXCERPT_CHARS = 300;
const STORED_BODY_CHARS = 8000;

const silentLogger = { info: () => {}, warn: () => {} };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const parseArgs = (argv) => {
  const options = {
    mode: "run",
    domains: TARGET_DOMAINS,
    variants: VARIANTS,
    failing: 15,
    controls: 3,
    since: "2026-07-15",
    smoke: false,
    feeds: FEED_CANDIDATES,
    perFeed: 15,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === "--baseline") {
      options.mode = "baseline";
      options.since = "2026-11-06";
    } else if (arg === "--report") {
      options.mode = "report";
    } else if (arg === "--corpus") {
      options.mode = "corpus";
    } else if (arg === "--retry") {
      options.mode = "retry";
    } else if (arg === "--feeds") {
      options.mode = "feeds";
      if (next && !next.startsWith("--")) {
        options.feeds = next.split(",").filter(Boolean);
        index += 1;
      }
    } else if (arg === "--per-feed" && next) {
      options.perFeed = Number(next);
      index += 1;
    } else if (arg === "--smoke") {
      options.smoke = true;
    } else if (arg === "--domains" && next) {
      options.domains = next.split(",").filter(Boolean);
      index += 1;
    } else if (arg === "--variants" && next) {
      options.variants = next.split(",").filter(Boolean);
      index += 1;
    } else if (arg === "--failing" && next) {
      options.failing = Number(next);
      index += 1;
    } else if (arg === "--controls" && next) {
      options.controls = Number(next);
      index += 1;
    } else if (arg === "--since" && next) {
      options.since = next;
      index += 1;
    }
  }
  if (options.smoke) {
    options.domains = options.domains.slice(0, 1);
    options.failing = 3;
    options.controls = 1;
  }

  return options;
};

const withDatabase = async (work) => {
  const connectionString = requireEnv("MEDIAPULSE_DATABASE_URL").replace(
    /\?.*$/,
    "",
  );
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    await client.query("BEGIN READ ONLY");
    await client.query("SET LOCAL search_path TO mediapulse");
    const result = await work(client);
    await client.query("COMMIT");

    return result;
  } finally {
    await client.end();
  }
};

const printBaseline = async ({ domains, since }) => {
  const { rows } = await withDatabase((client) =>
    client.query(
      `select d.registrable_domain as domain,
              count(*) filter (where f.status = 'succeeded')::int as succeeded,
              count(*) filter (where f.status = 'gate_dropped')::int as gate_dropped,
              count(*) filter (where f.status = 'fetch_failed')::int as fetch_failed,
              count(*)::int as total
         from fetch_event f
         join data_source d on d.id = f.data_source_id
        where f.created_at >= $1 and d.registrable_domain = any($2)
        group by 1
        order by total desc`,
      [since, domains],
    ),
  );
  console.log(`Fetch outcomes per domain since ${since} (UTC)\n`);
  console.log("| Domain | Succeeded | Gate dropped | Fetch failed | Failing |");
  console.log("| --- | --- | --- | --- | --- |");
  for (const row of rows) {
    const failing = Math.round((100 * (row.total - row.succeeded)) / row.total);
    console.log(
      `| ${row.domain} | ${row.succeeded} | ${row.gate_dropped} | ${row.fetch_failed} | ${failing}% of ${row.total} |`,
    );
  }
  const seen = new Set(rows.map((row) => row.domain));
  const silent = domains.filter((domain) => !seen.has(domain));
  if (silent.length > 0) {
    console.log(`\nNo fetches since ${since}: ${silent.join(", ")}`);
  }
};

const loadCorpus = async ({ domains, failing, controls, since }) => {
  const { rows } = await withDatabase((client) =>
    client.query(
      `select distinct on (d.url)
              d.registrable_domain as domain, d.url, d.title,
              coalesce(d.description, '') as description,
              f.status, f.created_at::text as "fetchedAt"
         from fetch_event f
         join data_source d on d.id = f.data_source_id
        where d.registrable_domain = any($1)
          and f.created_at >= $2
          and not (f.created_at >= $3 and f.created_at < $4)
        order by d.url, f.created_at desc`,
      [domains, since, SERPER_OUTAGE.start, SERPER_OUTAGE.end],
    ),
  );
  const resolvable = rows.filter(
    (row) => !isUnresolvableAggregatorUrl(row.url),
  );

  return pickCorpus(resolvable, { domains, failing, controls });
};

const scrapeWithProductionChain = async (url, title, providers) => {
  const [outcome] = await performWebFetch(
    [
      {
        url,
        title,
        content: "",
        tickerId: "fetch-domains-eval",
        searchQueryId: "",
        searchQueryText: "",
        serpIndex: 0,
      },
    ],
    { config: { providers }, logger: silentLogger },
  );
  if (outcome?.success) {
    return {
      fetched: true,
      title: outcome.success.title,
      body: outcome.success.content,
    };
  }
  const failure = outcome?.failures?.[0];

  return {
    fetched: false,
    errorCategory: failure?.errorCategory ?? "unknown",
    httpStatus: failure?.httpStatus ?? null,
  };
};

const scrapeWithMarkdown = async (url, apiKey) => {
  try {
    const response = await fetch(SERPER_SCRAPE_URL, {
      method: "POST",
      headers: {
        "X-API-KEY": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ url, includeMarkdown: true }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
      return {
        fetched: false,
        errorCategory: "provider_http_error",
        httpStatus: response.status,
      };
    }
    const payload = await response.json();
    const body =
      typeof payload.markdown === "string" && payload.markdown.trim() !== ""
        ? payload.markdown
        : (payload.text ?? "");
    if (body.trim() === "") {
      return {
        fetched: false,
        errorCategory: "provider_data_invalid",
        httpStatus: null,
      };
    }

    return {
      fetched: true,
      title: payload.metadata?.title,
      body,
      returnedMarkdown: typeof payload.markdown === "string",
    };
  } catch (error) {
    return {
      fetched: false,
      errorCategory:
        error?.name === "TimeoutError" ? "timeout_error" : "network_error",
      httpStatus: null,
    };
  }
};

const scrapeVariant = async (variant, url, title, apiKey, providers) => {
  if (variant === "markdown") {
    return scrapeWithMarkdown(url, apiKey);
  }
  if (variant === "markdown-text") {
    const attempt = await scrapeWithMarkdown(url, apiKey);
    if (!attempt.fetched) {
      return attempt;
    }
    const body = markdownToText(attempt.body);

    return body === ""
      ? {
          fetched: false,
          errorCategory: "provider_data_invalid",
          httpStatus: null,
        }
      : { ...attempt, body };
  }

  return scrapeWithProductionChain(url, title, providers);
};

const scoreAttempt = (row, triedUrl, attempt) => {
  if (!attempt.fetched) {
    return {
      triedUrl,
      fetched: false,
      errorCategory: attempt.errorCategory,
      httpStatus: attempt.httpStatus,
      words: 0,
      gateBlocked: false,
      gateReason: null,
      matchRatio: 0,
      usable: false,
      excerpt: "",
    };
  }
  const gateTitle = attempt.title ?? row.title;
  const decision = runQualityGate(gateTitle, attempt.body, triedUrl);
  const scored = {
    triedUrl,
    fetched: true,
    errorCategory: null,
    httpStatus: null,
    words: wordCount(attempt.body),
    gateBlocked: decision.blocked,
    gateReason: decision.blocked ? decision.reason : null,
    matchRatio: articleMatch(row.title, attempt.body),
    contentMatchRatio: contentMatch(row.title, attempt.body),
    excerpt: attempt.body.slice(0, EXCERPT_CHARS),
    body: attempt.body.slice(0, STORED_BODY_CHARS),
    ...(attempt.returnedMarkdown === undefined
      ? {}
      : { returnedMarkdown: attempt.returnedMarkdown }),
  };

  return { ...scored, usable: isUsable(scored) };
};

const readCells = () =>
  existsSync(RESULTS_PATH)
    ? readFileSync(RESULTS_PATH, "utf8")
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line))
    : [];

const writeReport = (domains) => {
  const report = renderReport(summarize(readCells()), domains);
  writeFileSync(REPORT_PATH, `${report}\n`);
  console.log(`\n${report}\n\nReport: ${REPORT_PATH}`);
};

const runEval = async (options) => {
  const apiKey = requireEnv("SERPER_API_KEY");
  const providers = expandFetchProviderEntries([
    { provider: "serper", apiKey },
  ]);
  mkdirSync(OUT_DIR, { recursive: true });

  const corpus = await loadCorpus(options);
  writeFileSync(CORPUS_PATH, JSON.stringify(corpus, null, 2));
  const done = new Set(
    readCells().map((cell) => cellKey(cell.variant, cell.url)),
  );
  const pending = corpus.flatMap((row) =>
    options.variants
      .filter((variant) => variantUrls(variant, row.url).length > 0)
      .filter((variant) => !done.has(cellKey(variant, row.url)))
      .map((variant) => ({ row, variant })),
  );
  const calls = pending.reduce(
    (total, { row, variant }) => total + variantUrls(variant, row.url).length,
    0,
  );
  console.log(
    `${corpus.length} URLs across ${options.domains.length} domains; ${pending.length} cells to run, at most ${calls} Serper calls.`,
  );

  for (const [index, { row, variant }] of pending.entries()) {
    let best = null;
    for (const triedUrl of variantUrls(variant, row.url)) {
      const attempt = await scrapeVariant(
        variant,
        triedUrl,
        row.title,
        apiKey,
        providers,
      );
      const scored = scoreAttempt(row, triedUrl, attempt);
      await sleep(REQUEST_GAP_MS);
      if (!best || (scored.usable && !best.usable)) {
        best = scored;
      }
      if (scored.usable) {
        break;
      }
    }
    const cell = {
      domain: row.domain,
      kind: row.kind,
      url: row.url,
      variant,
      status: row.status,
      ...best,
    };
    appendFileSync(RESULTS_PATH, `${JSON.stringify(cell)}\n`);
    console.log(
      `[${index + 1}/${pending.length}] ${row.domain} ${variant} ${cell.usable ? "usable" : cell.fetched ? `blocked:${cell.gateReason ?? "no match"}` : `failed:${cell.errorCategory}`} ${cell.words}w`,
    );
  }

  writeReport(options.domains);
};

const loadGot = async () => {
  const requireFromPageCollection = createRequire(
    new URL(
      "../apps/mediapulse/agents/page-collection/package.json",
      import.meta.url,
    ),
  );
  const module = await import(
    pathToFileURL(requireFromPageCollection.resolve("got")).href
  );

  return module.default;
};

const isTransientFailure = (cell) =>
  !cell.fetched &&
  (cell.errorCategory === "timeout_error" ||
    cell.errorCategory === "network_error" ||
    (cell.httpStatus ?? 0) >= 500);

const runRetry = async ({ domains }) => {
  const apiKey = requireEnv("SERPER_API_KEY");
  const providers = expandFetchProviderEntries([
    { provider: "serper", apiKey },
  ]);
  const cells = readCells();
  const retried = new Set(
    cells.filter((cell) => cell.variant === "retry").map((cell) => cell.url),
  );
  const pending = cells.filter(
    (cell) =>
      cell.variant === "baseline" &&
      domains.includes(cell.domain) &&
      isTransientFailure(cell) &&
      !retried.has(cell.url),
  );
  const titleByUrl = new Map(
    JSON.parse(readFileSync(CORPUS_PATH, "utf8")).map((entry) => [
      entry.url,
      entry.title,
    ]),
  );
  console.log(
    `${pending.length} baseline cells failed transiently; retrying once.`,
  );
  for (const cell of pending) {
    const title = titleByUrl.get(cell.url) ?? "";
    const attempt = await scrapeWithProductionChain(cell.url, title, providers);
    const scored = scoreAttempt({ title }, cell.url, attempt);
    await sleep(REQUEST_GAP_MS);
    appendFileSync(
      RESULTS_PATH,
      `${JSON.stringify({ domain: cell.domain, kind: cell.kind, url: cell.url, variant: "retry", status: cell.status, ...scored })}\n`,
    );
    console.log(
      `${cell.domain} retry ${scored.usable ? "usable" : scored.fetched ? `blocked:${scored.gateReason ?? "no match"}` : `failed:${scored.errorCategory}`} ${scored.words}w`,
    );
  }
};

const runFeeds = async ({ feeds, perFeed }) => {
  const apiKey = requireEnv("SERPER_API_KEY");
  const providers = expandFetchProviderEntries([
    { provider: "serper", apiKey },
  ]);
  mkdirSync(OUT_DIR, { recursive: true });
  const discoveryDeps = {
    gotClient: await loadGot(),
    rateLimiter: new RateLimiter(2, 1),
    logger: silentLogger,
    timeoutMs: DISCOVERY_TIMEOUT_MS,
  };
  const done = new Set(
    (existsSync(FEEDS_PATH)
      ? readFileSync(FEEDS_PATH, "utf8").split("\n").filter(Boolean)
      : []
    )
      .map((line) => JSON.parse(line))
      .map((cell) => `${cell.feed}|${cell.url}`),
  );
  const rows = [];

  for (const feed of feeds) {
    const items = await expandSourceUrl(feed, discoveryDeps, {
      linkType: "listing",
    });
    const stats = feedStats(items, {
      now: Date.now(),
      isExcluded: (url) => newsletterExclusionOf(url) !== undefined,
    });
    const sample = newestFirst(
      items.filter((item) => newsletterExclusionOf(item.url) === undefined),
    ).slice(0, perFeed);
    let usable = 0;
    const gateReasons = {};
    for (const item of sample) {
      if (done.has(`${feed}|${item.url}`)) {
        continue;
      }
      const row = { title: item.title ?? "" };
      const attempt = await scrapeWithProductionChain(
        item.url,
        row.title,
        providers,
      );
      const scored = scoreAttempt(row, item.url, attempt);
      await sleep(REQUEST_GAP_MS);
      appendFileSync(
        FEEDS_PATH,
        `${JSON.stringify({ feed, url: item.url, publishedAt: item.publishedAt ?? null, ...scored })}\n`,
      );
    }
    const cells = (
      existsSync(FEEDS_PATH)
        ? readFileSync(FEEDS_PATH, "utf8").split("\n").filter(Boolean)
        : []
    )
      .map((line) => JSON.parse(line))
      .filter((cell) => cell.feed === feed);
    for (const cell of cells) {
      if (cell.usable) {
        usable += 1;
      } else if (cell.gateReason) {
        gateReasons[cell.gateReason] = (gateReasons[cell.gateReason] ?? 0) + 1;
      }
    }
    const topReason =
      Object.entries(gateReasons).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
    rows.push(
      `| ${feed} | ${stats.items} | ${stats.fresh} | ${stats.direct} | ${usable}/${cells.length} | ${topReason} |`,
    );
    console.log(
      `${feed}: ${stats.items} items, ${stats.fresh} in 24h, ${usable}/${cells.length} usable`,
    );
  }

  const report = [
    "Direct feeds scored the way page-collection discovers them, then fetched through Serper.",
    "",
    "| Feed | Items | Published in 24h | Direct links | Usable bodies | Top gate reason |",
    "| --- | --- | --- | --- | --- | --- |",
    ...rows,
  ].join("\n");
  writeFileSync(FEEDS_REPORT_PATH, `${report}\n`);
  console.log(`\n${report}\n\nReport: ${FEEDS_REPORT_PATH}`);
};

const main = async () => {
  const options = parseArgs(process.argv.slice(2));
  if (options.mode === "baseline") {
    await printBaseline(options);
    return;
  }
  if (options.mode === "retry") {
    await runRetry(options);
    return;
  }
  if (options.mode === "feeds") {
    await runFeeds(options);
    return;
  }
  if (options.mode === "report") {
    writeReport(options.domains);
    return;
  }
  if (options.mode === "corpus") {
    const corpus = await loadCorpus(options);
    mkdirSync(OUT_DIR, { recursive: true });
    writeFileSync(CORPUS_PATH, JSON.stringify(corpus, null, 2));
    for (const domain of options.domains) {
      const rows = corpus.filter((row) => row.domain === domain);
      const failing = rows.filter((row) => row.kind === "failing").length;
      console.log(
        `${domain}: ${failing} failing, ${rows.length - failing} controls`,
      );
    }
    const calls = corpus.reduce(
      (total, row) =>
        total +
        options.variants.reduce(
          (sum, variant) => sum + variantUrls(variant, row.url).length,
          0,
        ),
      0,
    );
    console.log(
      `\n${corpus.length} URLs; at most ${calls} Serper calls for ${options.variants.join(", ")}. Corpus: ${CORPUS_PATH}`,
    );
    return;
  }
  await runEval(options);
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
