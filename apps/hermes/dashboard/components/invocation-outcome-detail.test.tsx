import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { InvocationOutcomeDetailView } from "./invocation-outcome-detail";
import { buildInvocationOutcomeDetailModel } from "./use-invocation-outcome-detail";

describe("buildInvocationOutcomeDetailModel", () => {
  it("extracts run summary from agent response details", () => {
    const model = buildInvocationOutcomeDetailModel(null, {
      status: "success",
      details: {
        summary: { fetchFailed: 2, totalSources: 1, status: "partial_success" },
      },
      logs: [{ level: "warn", message: "partial" }],
    });

    expect(model.runSummary).toEqual({
      fetchFailed: 2,
      totalSources: 1,
      status: "partial_success",
    });
    expect(model.logs).toHaveLength(1);
  });
});

describe("InvocationOutcomeDetailView", () => {
  it("renders transport error and agent message", () => {
    const transportError = { message: "Agent HTTP 500", retryable: true };
    const model = buildInvocationOutcomeDetailModel(transportError, {
      status: "failure",
      message: "Page collection run failed",
      details: { failureReason: "insufficient_successful_sources" },
    });

    render(
      <InvocationOutcomeDetailView
        model={model}
        transportError={transportError}
      />,
    );

    expect(screen.getByText("Agent HTTP 500")).toBeInTheDocument();
    expect(screen.getByText("Page collection run failed")).toBeInTheDocument();
  });
});
