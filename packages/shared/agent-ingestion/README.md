# @workspace/agent-ingestion

Shared ingestion core for mediapulse collector agents. It turns a URL into a stored, gated source through discovery, a multi-provider fetch, content gates, and persistence helpers. Both `@mediapulse/data-collection` and `@mediapulse/page-collection` build on it so the fetch, gate, and persist logic lives in one place instead of being forked per agent.

## Why this package exists

`data-collection` searches the web for URLs, `page-collection` scrapes curated listing pages for URLs, but everything after the URL is identical: fetch the content through a provider chain, run quality, relevance, and freshness gates, dedup, and persist a `DataSource`. That shared back half was extracted here. Each agent keeps only its own front half (search vs listing discovery) and its own config.

## Scope

This is a `@workspace/*` package, not `@mediapulse/*`, because its entire dependency closure is shared infrastructure. It imports only `@workspace/agent-types`, `@workspace/agent-data-api-client`, `@workspace/utils`, and `@workspace/logger`. It never imports `@mediapulse/database` or `@mediapulse/env`. Callers inject the data-api client functions they want it to use, so the package stays free of product wiring.

## What is inside

| Area                   | Modules                                                                                                             | Purpose                                                                             |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Discovery              | `discovery/` (`rss`, `sitemap`, `generic-links`, `registry`, `run-discovery`)                                       | Turn a listing source into article items, with a per-source strategy fallback chain |
| Fetch                  | `web-fetch`, `fetch-providers/` (`serper`, `diffbot`, `firecrawl`, `firecrawl_selfhosted`, `jina`, `tavily`, `exa`) | Fetch article content through a per-URL provider fallback chain                     |
| Gates                  | `content-quality-gate`, `ticker-relevance-gate`, `freshness-gate`, `date-extractor`                                 | Keep or drop a fetched page by quality, alias and industry relevance, and recency   |
| Resilience             | `resilience` (`RateLimiter`), `host-error-tracker`, `error-classification`, `p-map`                                 | Rate limiting, adaptive backoff, host circuit breaking, and bounded concurrency     |
| Dedup and cache        | `resolve-existing-data-source-urls`, `resolve-dead-urls`                                                            | Skip URLs already stored or in the dead-url negative cache                          |
| Persist and accounting | `data-sources`, `run-status`                                                                                        | Map survivors to `DataCollectionInput` and derive run status from counters          |

`classifyNoisyUrl` is reused from `@workspace/utils` for URL canonicalization and noise filtering.

## Two resilience chains

The package gives a collector two independent fallback chains, both failing a unit only when every option is exhausted.

- **Discovery strategy chain** (how to extract article URLs from a listing): `rss` then `sitemap` then `generic-links`. A strategy that errors or returns nothing falls through to the next, so a site that drops its RSS feed is still covered.
- **Fetch provider chain** (how to fetch an article body): `serper` then `diffbot` then `firecrawl` then `jina`. A URL is only a fetch failure when the whole chain has failed.

The `firecrawl` and `firecrawl_selfhosted` adapters both call Firecrawl v2 (`/v2/scrape`). `firecrawl` authenticates with a bearer API key against the hosted API, while `firecrawl_selfhosted` targets an operator-supplied `baseUrl` and merges a generic `headers` map into every request (for example Cloudflare Access `CF-Access-Client-Id` / `CF-Access-Client-Secret`) instead of a bearer key.

## Usage

```ts
import {
  runDiscovery,
  performWebFetch,
  runQualityGate,
  isRelevant,
  isFresh,
  buildTickerAliases,
  buildIndustryAliases,
  toDataSources,
  deriveRunStatus,
} from "@workspace/agent-ingestion";

// 1. Discover candidate article URLs from curated listings (page-collection),
//    or feed search results straight to fetch (data-collection).
const { items, failures } = await runDiscovery(curatedSources, deps);

// 2. Fetch content through the provider chain.
const outcomes = await performWebFetch(candidates, deps);

// 3. Gate each page, then map survivors and persist via the injected client.
const sources = toDataSources(tickerId, survivors);
```

## What is not here

- Web search and query building (`web-search`, `serper-query`, `hit-ranker`) stay in `@mediapulse/data-collection`. They are search-specific.
- Per-agent input and config schemas stay in each agent.
- Environment and database access. The package takes data-api client functions as parameters and reads no env.

## Consumers

- `@mediapulse/data-collection`
- `@mediapulse/page-collection`
