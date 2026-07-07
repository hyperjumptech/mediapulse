import type { SearchLocale } from "@workspace/agent-search";

/** Query phrasing languages the pipeline builds candidates in. */
export const LANGUAGES = ["id", "en"] as const;

/** Locales probed for every candidate query (Indonesian + global/English). */
export const PROBE_LOCALES: SearchLocale[] = [
  { gl: "id", hl: "id" },
  { gl: "us", hl: "en" },
];

/** Total query rows persisted in the active query set. */
export const QUERY_COUNT = 24;

/** Maximum competitors kept from an LLM discovery result. */
export const DISCOVERY_MAX_COMPETITORS = 6;

/** Maximum regulators kept from an LLM discovery result. */
export const DISCOVERY_MAX_REGULATORS = 4;

/** Maximum search keywords kept per discovered entity. */
export const DISCOVERY_MAX_KEYWORDS_PER_ENTITY = 2;

/** Target number of candidates the generation LLM call is asked to produce per attempt. */
export const GENERATION_CANDIDATE_TARGET = 40;

/** Hard cap on candidates accepted from one generation LLM response. */
export const GENERATION_CANDIDATE_MAX = 60;

/** Maximum generation attempts (initial + retries) before accepting whatever survived probing. */
export const GENERATION_MAX_ATTEMPTS = 3;

/** SDK-level retries for one generation LLM call, so a transient blip does not fail the run. */
export const GENERATION_LLM_MAX_RETRIES = 2;

/** Hard cap on candidates admitted to the yield probe. */
export const PROBE_BUDGET = 80;

/** Concurrent probe requests in flight. */
export const PROBE_CONCURRENCY = 4;

/** Minimum probe hits for a candidate to survive (unless section-coverage protected). */
export const PROBE_MIN_RESULTS = 1;

/** Per-probe request timeout. */
export const PROBE_TIMEOUT_MS = 30_000;

/** Time-to-live for a written ticker-discovery cache entry (14 days). */
export const DISCOVERY_CACHE_TTL_SECONDS = 14 * 24 * 60 * 60;

/** Home market the pipeline anchors discovery and industry queries to. */
export const HOME_MARKET = "Indonesia";

/** Market anchor terms appended to industry-theme queries. */
export const MARKET_ANCHORS = ["Indonesia", "IDX"] as const;
