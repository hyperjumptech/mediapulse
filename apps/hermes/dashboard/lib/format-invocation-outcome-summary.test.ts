import { describe, expect, it } from "vitest";

import {
  formatInvocationOutcomeSummary,
  formatRunSummaryWarning,
  isStoredAgentResponseEnvelope,
  parseStoredAgentResponse,
} from "./format-invocation-outcome-summary";

describe("formatInvocationOutcomeSummary", () => {
  it("prefers transport error message over agent response", () => {
    // Act
    const result = formatInvocationOutcomeSummary(
      { message: "Agent HTTP 500", retryable: true },
      { status: "failure", message: "Semantic failure" },
    );

    // Assert
    expect(result).toBe("Agent HTTP 500");
  });

  it("returns agent response message for semantic failures", () => {
    // Act
    const result = formatInvocationOutcomeSummary(null, {
      status: "failure",
      message: "Page collection run failed: 0 sources persisted.",
    });

    // Assert
    expect(result).toBe("Page collection run failed: 0 sources persisted.");
  });

  it("returns failureReason when message is absent", () => {
    // Act
    const result = formatInvocationOutcomeSummary(null, {
      status: "failure",
      details: { failureReason: "insufficient_successful_sources" },
    });

    // Assert
    expect(result).toBe("insufficient_successful_sources");
  });

  it("returns run warning for partial success on successful envelope", () => {
    // Act
    const result = formatInvocationOutcomeSummary(null, {
      status: "success",
      details: {
        summary: {
          status: "partial_success",
          fetchFailed: 3,
          totalSources: 2,
        },
      },
    });

    // Assert
    expect(result).toBe("Partial success, 3 fetch failures, 2 persisted");
  });

  it("returns null when no error information is present", () => {
    // Act
    const result = formatInvocationOutcomeSummary(null, null);

    // Assert
    expect(result).toBeNull();
  });
});

describe("formatRunSummaryWarning", () => {
  it("reports zero discovery", () => {
    expect(
      formatRunSummaryWarning({ discoveredCount: 0, totalSources: 0 }),
    ).toBe("0 sources discovered");
  });

  it("returns null for clean success summary", () => {
    expect(
      formatRunSummaryWarning({
        status: "success",
        fetchFailed: 0,
        totalSources: 5,
        discoveredCount: 5,
      }),
    ).toBeNull();
  });
});

describe("parseStoredAgentResponse", () => {
  it("parses envelope objects", () => {
    const envelope = { status: "success", message: "ok" };
    expect(parseStoredAgentResponse(envelope)).toEqual(envelope);
    expect(isStoredAgentResponseEnvelope(envelope)).toBe(true);
  });

  it("returns null for non-objects", () => {
    expect(parseStoredAgentResponse("bad")).toBeNull();
    expect(isStoredAgentResponseEnvelope("bad")).toBe(false);
  });
});
