/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import { sanitizeDiagnosticMessage } from "./sanitize-diagnostic-message.js";

describe("sanitizeDiagnosticMessage", () => {
  // -------------------------------------------------------------------------
  // Basic format
  // -------------------------------------------------------------------------

  it("includes tickerId in the output", () => {
    // Act
    const result = sanitizeDiagnosticMessage({ tickerId: "ticker-abc" });

    // Assert
    expect(result).toContain("tickerId=ticker-abc");
  });

  it("formats a full message with all fields present", () => {
    // Act
    const result = sanitizeDiagnosticMessage({
      tickerId: "ticker-abc",
      outcomeCode: "openai_retry_exhausted",
      stage: "llm",
      detail: "retries exhausted",
    });

    // Assert
    expect(result).toBe(
      "tickerId=ticker-abc outcome=openai_retry_exhausted stage=llm: retries exhausted",
    );
  });

  it("omits outcome when not provided", () => {
    // Act
    const result = sanitizeDiagnosticMessage({
      tickerId: "ticker-abc",
      stage: "precheck",
    });

    // Assert
    expect(result).toBe("tickerId=ticker-abc stage=precheck");
    expect(result).not.toContain("outcome=");
  });

  it("omits stage when not provided", () => {
    // Act
    const result = sanitizeDiagnosticMessage({
      tickerId: "ticker-abc",
      outcomeCode: "no_sources",
    });

    // Assert
    expect(result).toBe("tickerId=ticker-abc outcome=no_sources");
    expect(result).not.toContain("stage=");
  });

  it("produces a minimal message with tickerId only on success", () => {
    // Act
    const result = sanitizeDiagnosticMessage({ tickerId: "ticker-xyz" });

    // Assert
    expect(result).toBe("tickerId=ticker-xyz");
  });

  // -------------------------------------------------------------------------
  // Secret redaction
  // -------------------------------------------------------------------------

  it("redacts sk- prefixed API keys from detail", () => {
    // Act
    const result = sanitizeDiagnosticMessage({
      tickerId: "ticker-1",
      outcomeCode: "openai_non_retryable",
      stage: "llm",
      detail: "key=sk-abc123xyz",
    });

    // Assert
    expect(result).not.toContain("sk-abc123xyz");
    expect(result).toContain("[REDACTED]");
  });

  it("redacts apiKey patterns from detail", () => {
    // Act
    const result = sanitizeDiagnosticMessage({
      tickerId: "ticker-1",
      detail: "apiKeyValue=supersecret",
    });

    // Assert
    expect(result).not.toContain("apiKeyValue");
    expect(result).toContain("[REDACTED]");
  });

  it("redacts api_key patterns from detail", () => {
    // Act
    const result = sanitizeDiagnosticMessage({
      tickerId: "ticker-1",
      detail: "api_key=mysecret",
    });

    // Assert
    expect(result).not.toContain("api_key=mysecret");
    expect(result).toContain("[REDACTED]");
  });

  it("redacts Bearer tokens from detail", () => {
    // Act
    const result = sanitizeDiagnosticMessage({
      tickerId: "ticker-1",
      detail: "auth=Bearer eyJhbGci",
    });

    // Assert
    expect(result).not.toContain("Bearer eyJhbGci");
    expect(result).toContain("[REDACTED]");
  });

  it("redacts token= values from detail", () => {
    // Act
    const result = sanitizeDiagnosticMessage({
      tickerId: "ticker-1",
      detail: "token=abcdef123",
    });

    // Assert
    expect(result).not.toContain("token=abcdef123");
    expect(result).toContain("[REDACTED]");
  });

  // -------------------------------------------------------------------------
  // Truncation
  // -------------------------------------------------------------------------

  it("truncates detail longer than 200 characters and appends ellipsis", () => {
    // Setup
    const longDetail = "x".repeat(250);

    // Act
    const result = sanitizeDiagnosticMessage({
      tickerId: "ticker-1",
      detail: longDetail,
    });

    // Assert
    expect(result).toContain("...");
    // The detail portion should not exceed 200 chars + "..."
    const detailPart = result.split(": ")[1]!;
    expect(detailPart.length).toBeLessThanOrEqual(203); // 200 + "..."
  });

  it("does not truncate detail within the 200 character limit", () => {
    // Setup
    const shortDetail = "y".repeat(200);

    // Act
    const result = sanitizeDiagnosticMessage({
      tickerId: "ticker-1",
      detail: shortDetail,
    });

    // Assert
    expect(result).not.toContain("...");
    expect(result).toContain(shortDetail);
  });

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------

  it("omits the detail suffix when detail is an empty string", () => {
    // Act
    const result = sanitizeDiagnosticMessage({
      tickerId: "ticker-1",
      outcomeCode: "persist_transient",
      stage: "persist",
      detail: "",
    });

    // Assert
    expect(result).toBe(
      "tickerId=ticker-1 outcome=persist_transient stage=persist",
    );
    expect(result).not.toContain(":");
  });

  it("handles undefined detail gracefully", () => {
    // Act
    const result = sanitizeDiagnosticMessage({
      tickerId: "ticker-1",
      outcomeCode: "validation_failed",
      stage: "validate",
    });

    // Assert
    expect(result).toBe(
      "tickerId=ticker-1 outcome=validation_failed stage=validate",
    );
    expect(result).not.toContain("undefined");
  });
});
