/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import type { AgentOutcome } from "./types/outcome.js";
import { mapOutcomeToDiagnostic } from "./outcome-to-diagnostic.js";

describe("mapOutcomeToDiagnostic", () => {
  // -------------------------------------------------------------------------
  // Success (null input)
  // -------------------------------------------------------------------------

  it("returns outcome=success with all nulls when agentOutcome is null", () => {
    // Act
    const result = mapOutcomeToDiagnostic(null);

    // Assert
    expect(result).toEqual({
      outcome: "success",
      stage: null,
      errorCode: null,
      errorCategory: null,
    });
  });

  // -------------------------------------------------------------------------
  // Skip outcomes
  // -------------------------------------------------------------------------

  it("maps no_sources to skipped / precheck", () => {
    // Setup
    const agentOutcome: AgentOutcome = {
      outcome: "no_sources",
      skipped: true,
    };

    // Act
    const result = mapOutcomeToDiagnostic(agentOutcome);

    // Assert
    expect(result).toEqual({
      outcome: "skipped",
      stage: "precheck",
      errorCode: "no_sources",
      errorCategory: null,
    });
  });

  it("maps skipped_insufficient_sources to skipped / precheck", () => {
    // Setup
    const agentOutcome: AgentOutcome = {
      outcome: "skipped_insufficient_sources",
      skipped: true,
    };

    // Act
    const result = mapOutcomeToDiagnostic(agentOutcome);

    // Assert
    expect(result).toEqual({
      outcome: "skipped",
      stage: "precheck",
      errorCode: "skipped_insufficient_sources",
      errorCategory: null,
    });
  });

  it("maps skipped_fresh_newsletter_stale_analysis to skipped / precheck", () => {
    // Setup
    const agentOutcome: AgentOutcome = {
      outcome: "skipped_fresh_newsletter_stale_analysis",
      skipped: true,
    };

    // Act
    const result = mapOutcomeToDiagnostic(agentOutcome);

    // Assert
    expect(result).toEqual({
      outcome: "skipped",
      stage: "precheck",
      errorCode: "skipped_fresh_newsletter_stale_analysis",
      errorCategory: null,
    });
  });

  it("maps skipped_fresh_newsletter_exists to skipped / precheck", () => {
    // Setup
    const agentOutcome: AgentOutcome = {
      outcome: "skipped_fresh_newsletter_exists",
      skipped: true,
    };

    // Act
    const result = mapOutcomeToDiagnostic(agentOutcome);

    // Assert
    expect(result).toEqual({
      outcome: "skipped",
      stage: "precheck",
      errorCode: "skipped_fresh_newsletter_exists",
      errorCategory: null,
    });
  });

  // -------------------------------------------------------------------------
  // LLM failure outcomes
  // -------------------------------------------------------------------------

  it("maps openai_retry_exhausted to failed / llm / retryable_llm", () => {
    // Setup
    const agentOutcome: AgentOutcome = {
      outcome: "openai_retry_exhausted",
      skipped: false,
    };

    // Act
    const result = mapOutcomeToDiagnostic(agentOutcome);

    // Assert
    expect(result).toEqual({
      outcome: "failed",
      stage: "llm",
      errorCode: "openai_retry_exhausted",
      errorCategory: "retryable_llm",
    });
  });

  it("maps openai_non_retryable to failed / llm / non_retryable_llm", () => {
    // Setup
    const agentOutcome: AgentOutcome = {
      outcome: "openai_non_retryable",
      skipped: false,
    };

    // Act
    const result = mapOutcomeToDiagnostic(agentOutcome);

    // Assert
    expect(result).toEqual({
      outcome: "failed",
      stage: "llm",
      errorCode: "openai_non_retryable",
      errorCategory: "non_retryable_llm",
    });
  });

  it("maps openai_invalid_response to failed / llm / non_retryable_llm", () => {
    // Setup
    const agentOutcome: AgentOutcome = {
      outcome: "openai_invalid_response",
      skipped: false,
    };

    // Act
    const result = mapOutcomeToDiagnostic(agentOutcome);

    // Assert
    expect(result).toEqual({
      outcome: "failed",
      stage: "llm",
      errorCode: "openai_invalid_response",
      errorCategory: "non_retryable_llm",
    });
  });

  // -------------------------------------------------------------------------
  // Validation failure
  // -------------------------------------------------------------------------

  it("maps validation_failed to failed / validate / validation", () => {
    // Setup
    const agentOutcome: AgentOutcome = {
      outcome: "validation_failed",
      skipped: false,
    };

    // Act
    const result = mapOutcomeToDiagnostic(agentOutcome);

    // Assert
    expect(result).toEqual({
      outcome: "failed",
      stage: "validate",
      errorCode: "validation_failed",
      errorCategory: "validation",
    });
  });

  // -------------------------------------------------------------------------
  // Persist failure outcomes
  // -------------------------------------------------------------------------

  it("maps persist_transient to failed / persist / persistence", () => {
    // Setup
    const agentOutcome: AgentOutcome = {
      outcome: "persist_transient",
      skipped: false,
    };

    // Act
    const result = mapOutcomeToDiagnostic(agentOutcome);

    // Assert
    expect(result).toEqual({
      outcome: "failed",
      stage: "persist",
      errorCode: "persist_transient",
      errorCategory: "persistence",
    });
  });

  it("maps persist_client_error to failed / persist / persistence", () => {
    // Setup
    const agentOutcome: AgentOutcome = {
      outcome: "persist_client_error",
      skipped: false,
    };

    // Act
    const result = mapOutcomeToDiagnostic(agentOutcome);

    // Assert
    expect(result).toEqual({
      outcome: "failed",
      stage: "persist",
      errorCode: "persist_client_error",
      errorCategory: "persistence",
    });
  });
});
