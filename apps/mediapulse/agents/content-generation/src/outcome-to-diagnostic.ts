import type {
  ContentGenerationRunOutcome,
  ContentGenerationRunStage,
} from "@workspace/agent-data-api-contract";

import type { AgentOutcome } from "./types/outcome.js";

/**
 * Result of mapping an internal {@link AgentOutcome} to the fields required by
 * the `contentGenerationRuns.create` SDK call.
 */
export type DiagnosticMapping = {
  /** Diagnostic outcome value used by the API contract. */
  outcome: ContentGenerationRunOutcome;
  /** Pipeline stage where the outcome was determined; `null` for success. */
  stage: ContentGenerationRunStage | null;
  /** Outcome code string forwarded as `errorCode`; `null` for success. */
  errorCode: string | null;
  /** Human-readable error category; `null` for success and skips. */
  errorCategory: string | null;
};

/**
 * Maps an internal {@link AgentOutcome} (or `null` for success) to the diagnostic
 * record fields required by the `contentGenerationRuns.create` SDK call.
 *
 * Pass `null` when the run completed successfully — this produces `outcome: "success"`
 * with all optional fields set to `null`. Pass the actual {@link AgentOutcome} for
 * every skip or failure path.
 *
 * This is a pure function with no side effects, making it trivially testable.
 *
 * @param agentOutcome - Canonical outcome produced by the pipeline, or `null` on success.
 * @returns Diagnostic field values ready to pass to the SDK.
 */
export function mapOutcomeToDiagnostic(
  agentOutcome: AgentOutcome | null,
): DiagnosticMapping {
  if (agentOutcome === null) {
    return {
      outcome: "success",
      stage: null,
      errorCode: null,
      errorCategory: null,
    };
  }

  const { outcome } = agentOutcome;

  switch (outcome) {
    case "no_sources":
      return {
        outcome: "skipped",
        stage: "precheck",
        errorCode: "no_sources",
        errorCategory: null,
      };

    case "skipped_fresh_newsletter_exists":
      return {
        outcome: "skipped",
        stage: "precheck",
        errorCode: "skipped_fresh_newsletter_exists",
        errorCategory: null,
      };

    case "skipped_fresh_newsletter_stale_analysis":
      return {
        outcome: "skipped",
        stage: "precheck",
        errorCode: "skipped_fresh_newsletter_stale_analysis",
        errorCategory: null,
      };

    case "openai_retry_exhausted":
      return {
        outcome: "failed",
        stage: "llm",
        errorCode: "openai_retry_exhausted",
        errorCategory: "retryable_llm",
      };

    case "openai_non_retryable":
      return {
        outcome: "failed",
        stage: "llm",
        errorCode: "openai_non_retryable",
        errorCategory: "non_retryable_llm",
      };

    case "openai_invalid_response":
      return {
        outcome: "failed",
        stage: "llm",
        errorCode: "openai_invalid_response",
        errorCategory: "non_retryable_llm",
      };

    case "validation_failed":
      return {
        outcome: "failed",
        stage: "validate",
        errorCode: "validation_failed",
        errorCategory: "validation",
      };

    case "persist_transient":
      return {
        outcome: "failed",
        stage: "persist",
        errorCode: "persist_transient",
        errorCategory: "persistence",
      };

    case "persist_client_error":
      return {
        outcome: "failed",
        stage: "persist",
        errorCode: "persist_client_error",
        errorCategory: "persistence",
      };
  }
}
