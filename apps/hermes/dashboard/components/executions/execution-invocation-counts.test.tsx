import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ExecutionInvocationCounts } from "./execution-invocation-counts";

describe("ExecutionInvocationCounts", () => {
  it("highlights failed invocations", () => {
    render(
      <ExecutionInvocationCounts
        succeededInvocationCount={4}
        failedInvocationCount={1}
      />,
    );

    const counts = screen.getByTitle("4 succeeded, 1 failed");
    const failedCount = counts.querySelector("[data-failed]");

    expect(counts).toHaveTextContent("4 / 1");
    expect(failedCount).toHaveAttribute("data-failed", "true");
    expect(failedCount).toHaveClass("text-destructive");
  });

  it("mutes the failed count when nothing failed", () => {
    render(
      <ExecutionInvocationCounts
        succeededInvocationCount={2}
        failedInvocationCount={0}
      />,
    );

    const failedCount = screen
      .getByTitle("2 succeeded, 0 failed")
      .querySelector("[data-failed]");

    expect(failedCount).toHaveAttribute("data-failed", "false");
    expect(failedCount).toHaveClass("text-muted-foreground");
  });
});
