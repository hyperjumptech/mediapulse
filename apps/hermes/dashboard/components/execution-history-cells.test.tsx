import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ExecutionInvocationCounts,
  ExecutionJobCounts,
  ExecutionTimeLink,
  ExecutionsEmptyState,
  ViewExecutionLink,
} from "./execution-history-cells";

describe("ExecutionsEmptyState", () => {
  it("explains that nothing has run yet", () => {
    // Act
    render(<ExecutionsEmptyState description="Runs appear here." />);

    // Assert
    expect(screen.getByText("No executions yet")).toBeInTheDocument();
    expect(screen.getByText("Runs appear here.")).toBeInTheDocument();
  });
});

describe("ExecutionTimeLink", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-28T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("links the relative execution time to the execution", () => {
    // Act
    render(
      <ExecutionTimeLink
        href="/dashboard/schedules/s-1/executions/e-1"
        executionTime={new Date("2026-09-28T11:55:00Z")}
      />,
    );

    // Assert
    const link = screen.getByRole("link", {
      name: "Open execution from 5m ago",
    });

    expect(link).toHaveAttribute(
      "href",
      "/dashboard/schedules/s-1/executions/e-1",
    );
    expect(link.querySelector("time")).toHaveAttribute(
      "datetime",
      "2026-09-28T11:55:00.000Z",
    );
  });
});

describe("ExecutionJobCounts", () => {
  it("shows created and enqueued jobs with a description", () => {
    // Act
    render(<ExecutionJobCounts jobsCreated={3} jobsEnqueued={2} />);

    // Assert
    const counts = screen.getByTitle("3 created, 2 enqueued");

    expect(counts).toHaveTextContent("3 / 2");
    expect(counts).toHaveClass("tabular-nums");
  });
});

describe("ExecutionInvocationCounts", () => {
  it("highlights failed invocations", () => {
    // Act
    render(
      <ExecutionInvocationCounts
        succeededInvocationCount={4}
        failedInvocationCount={1}
      />,
    );

    // Assert
    const counts = screen.getByTitle("4 succeeded, 1 failed");
    const failedCount = counts.querySelector("[data-failed]");

    expect(counts).toHaveTextContent("4 / 1");
    expect(failedCount).toHaveAttribute("data-failed", "true");
    expect(failedCount).toHaveClass("text-destructive");
  });

  it("mutes the failed count when nothing failed", () => {
    // Act
    render(
      <ExecutionInvocationCounts
        succeededInvocationCount={2}
        failedInvocationCount={0}
      />,
    );

    // Assert
    const failedCount = screen
      .getByTitle("2 succeeded, 0 failed")
      .querySelector("[data-failed]");

    expect(failedCount).toHaveAttribute("data-failed", "false");
    expect(failedCount).toHaveClass("text-muted-foreground");
  });
});

describe("ViewExecutionLink", () => {
  it("links to the execution detail", () => {
    // Act
    render(
      <ViewExecutionLink href="/dashboard/pipelines/p-1/executions/e-1" />,
    );

    // Assert
    expect(screen.getByRole("link", { name: "View" })).toHaveAttribute(
      "href",
      "/dashboard/pipelines/p-1/executions/e-1",
    );
  });
});
