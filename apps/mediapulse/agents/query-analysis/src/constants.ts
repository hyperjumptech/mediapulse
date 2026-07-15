import type { SearchLocale } from "@workspace/agent-search";

/** Identity recorded on each generated SearchQuerySet for provenance. */
export const QUERY_ANALYSIS_AGENT_ID = "query-analysis";
export const QUERY_ANALYSIS_AGENT_VERSION = "3.0.0";

/** Query phrasing languages the pipeline builds candidates in. */
export const LANGUAGES = ["id", "en"] as const;

/** Locales probed for every candidate query (Indonesian + global/English). */
export const PROBE_LOCALES: SearchLocale[] = [
  { gl: "id", hl: "id" },
  { gl: "us", hl: "en" },
];

/** Total query rows persisted in the active query set. */
export const QUERY_COUNT = 55;

/** Minimum queries guaranteed per intent in the persisted set (backfilled from probe-dropped candidates). */
export const PER_INTENT_FLOOR = 5;

/** Maximum queries any single intent may occupy, so no intent crowds out the others. */
export const PER_INTENT_MAX = 8;

/** Surviving-query count that ends the generation retry loop early (decoupled from the persisted cap). */
export const GENERATION_MIN_SURVIVORS = 24;

/** Maximum competitors kept from an LLM discovery result. */
export const DISCOVERY_MAX_COMPETITORS = 6;

/** Maximum regulators kept from an LLM discovery result. */
export const DISCOVERY_MAX_REGULATORS = 4;

/** Maximum search keywords kept per discovered entity. */
export const DISCOVERY_MAX_KEYWORDS_PER_ENTITY = 2;

/** Target number of candidates the generation LLM call is asked to produce per attempt. */
export const GENERATION_CANDIDATE_TARGET = 60;

/** Hard cap on candidates accepted from one generation LLM response. */
export const GENERATION_CANDIDATE_MAX = 90;

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
export const PROBE_TIMEOUT_MS = 10_000;

/** Time-to-live for a written ticker-discovery cache entry (14 days). */
export const DISCOVERY_CACHE_TTL_SECONDS = 14 * 24 * 60 * 60;

/** Maximum broad recon searches run before generation to gather current-event signals. */
export const RECON_MAX_QUERIES = 12;

/** Maximum discovered competitors given a dedicated recon search. */
export const RECON_MAX_COMPETITORS = 4;

/** Maximum headline signals fed into the generation prompt. */
export const RECON_MAX_SIGNALS = 8;

/** Results kept from each recon search before dedupe/cap. */
export const RECON_RESULTS_PER_QUERY = 5;

/** Concurrent recon searches in flight. */
export const RECON_CONCURRENCY = 4;

/** Per-recon-search request timeout. */
export const RECON_TIMEOUT_MS = 10_000;

/** Home market the pipeline anchors discovery and industry queries to. */
export const HOME_MARKET = "Indonesia";

/** Market anchor terms appended to industry-theme queries. */
export const MARKET_ANCHORS = ["Indonesia", "IDX"] as const;
