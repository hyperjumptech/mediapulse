import { describe, expect, it } from "vitest";

import type { AgentOutcome, OutcomeCode } from "./outcome.js";

describe("OutcomeCode", () => {
  it("includes all 8 required outcome codes", () => {
    // Setup
    const codes: OutcomeCode[] = [
      "no_sources",
      "skipped_fresh_newsletter_exists",
      "openai_retry_exhausted",
      "openai_non_retryable",
      "openai_invalid_response",
      "validation_failed",
      "persist_transient",
      "persist_client_error",
    ];

    // Assert
    expect(codes).toHaveLength(8);
  });
});

describe("AgentOutcome", () => {
  it("constructs a skipped no_sources outcome with message", () => {
    // Act
    const outcome: AgentOutcome = {
      outcome: "no_sources",
      skipped: true,
      message: "No data sources found for this ticker",
    };

    // Assert
    expect(outcome.outcome).toBe("no_sources");
    expect(outcome.skipped).toBe(true);
    expect(outcome.message).toBe("No data sources found for this ticker");
  });

  it("constructs a non-skipped error outcome without message", () => {
    // Act
    const outcome: AgentOutcome = {
      outcome: "openai_retry_exhausted",
      skipped: false,
    };

    // Assert
    expect(outcome.outcome).toBe("openai_retry_exhausted");
    expect(outcome.skipped).toBe(false);
    expect(outcome.message).toBeUndefined();
  });

  it("constructs skipped_fresh_newsletter_exists as skipped", () => {
    // Act
    const outcome: AgentOutcome = {
      outcome: "skipped_fresh_newsletter_exists",
      skipped: true,
    };

    // Assert
    expect(outcome.skipped).toBe(true);
  });

  it("constructs all non-skipped error outcomes with skipped: false", () => {
    // Setup
    const errorCodes: OutcomeCode[] = [
      "openai_retry_exhausted",
      "openai_non_retryable",
      "openai_invalid_response",
      "validation_failed",
      "persist_transient",
      "persist_client_error",
    ];

    // Act & Assert
    for (const code of errorCodes) {
      const outcome: AgentOutcome = { outcome: code, skipped: false };
      expect(outcome.skipped).toBe(false);
    }
  });
});
