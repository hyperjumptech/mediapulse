/**
 * All possible outcome codes for a content-generation agent run.
 *
 * Used by:
 * - MP-CGA-006 (skip-if-fresh): `skipped_fresh_newsletter_exists`
 * - MP-CGA-007 (diagnostics): all codes for writing diagnostic records
 * - MP-CGA-008 (reporting): all codes for outcome reporting
 */
export type OutcomeCode =
  /** No data sources found for the ticker; run is skipped without calling OpenAI. */
  | "no_sources"
  /**
   * Sources exist but too few would ship to make an issue: fewer than
   * `minShippableArticles` classified articles, or fewer than `minShippableSections`
   * sections holding one. Run is skipped without calling OpenAI.
   */
  | "skipped_insufficient_sources"
  /**
   * Sources cleared the precheck floor and the issue was generated, but too few articles
   * survived summarization and the output guards to ship. Distinct from
   * `skipped_insufficient_sources`: the LLM ran, so this is attrition inside generation rather
   * than a quiet news day.
   */
  | "skipped_nothing_survived_generation"
  /** A fresh newsletter was generated recently; run is skipped (MP-CGA-006). */
  | "skipped_fresh_newsletter_exists"
  /**
   * Same skip as above, but articles were classified for this ticker after that newsletter was
   * written, so the skip discards analysis the newsletter never saw.
   */
  | "skipped_fresh_newsletter_stale_analysis"
  /** LLM returned a retryable error and all retry attempts were exhausted. */
  | "openai_retry_exhausted"
  /** LLM returned a non-retryable error (e.g. auth failure, bad request). */
  | "openai_non_retryable"
  /** LLM returned HTTP 200 but the response body had an unexpected shape. */
  | "openai_invalid_response"
  /** LLM output passed HTTP validation but failed Zod schema validation. */
  | "validation_failed"
  /** agent-data-api returned a transient error (429 or 5xx) on newsletter create. */
  | "persist_transient"
  /** agent-data-api returned a non-retryable client error (4xx) on newsletter create. */
  | "persist_client_error";

/**
 * Internal outcome record for a content-generation agent run.
 *
 * Carries the structured outcome code and skip flag for MP-CGA-007 diagnostic writes.
 * This is distinct from `AgentRunResult` — the Hermes envelope
 * (`{ success: true/false, message? }`) shape is unchanged.
 */
export type AgentOutcome = {
  /** Canonical outcome code identifying the exit path of the run. */
  outcome: OutcomeCode;
  /**
   * True when the run was intentionally skipped (no failure, no generation needed).
   * Currently used for `no_sources`, `skipped_fresh_newsletter_exists`, and
   * `skipped_fresh_newsletter_stale_analysis`.
   */
  skipped: boolean;
  /** Optional human-readable context for logging. */
  message?: string;
};
