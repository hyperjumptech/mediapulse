import { QUERY_ANALYSIS_INTENTS } from "@workspace/agent-data-api-contract";
import type { SearchLocale } from "@workspace/agent-search";

/** Identity recorded on each generated SearchQuerySet for provenance. */
export const QUERY_ANALYSIS_AGENT_ID = "query-analysis";
export const QUERY_ANALYSIS_AGENT_VERSION = "3.0.0";

/** Query phrasing languages the pipeline builds candidates in. */
export const LANGUAGES = ["id", "en"] as const;

/** Locale the recon step searches in (Indonesian home market). */
export const RECON_LOCALE: SearchLocale = { gl: "id", hl: "id" };

/**
 * Fallback per-intent query budget, used when config omits `generation.queriesPerIntent`.
 * Every intent is filled to this number so each newsletter section is fed equally.
 */
export const DEFAULT_QUERIES_PER_INTENT = 5;

/** Maximum generation attempts (initial + retries) before accepting whatever was generated. */
export const GENERATION_MAX_ATTEMPTS = 3;

/** SDK-level retries for one generation LLM call, so a transient blip does not fail the run. */
export const GENERATION_LLM_MAX_RETRIES = 2;

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
