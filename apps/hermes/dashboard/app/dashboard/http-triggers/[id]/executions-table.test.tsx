import React from "react";
import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { HttpTriggerExecutionRow } from "@/lib/http-triggers";

import { ExecutionsTable } from "./executions-table";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const createMockExecution = (
  overrides?: Partial<HttpTriggerExecutionRow>,
): HttpTriggerExecutionRow => ({
  id: "ex-1",
  executionTime: new Date("2026-09-28T11:00:00Z"),
  enqueueStatus: "success",
  runStatus: "succeeded",
  jobsCreated: 1,
  jobsEnqueued: 1,
  succeededInvocationCount: 1,
  failedInvocationCount: 0,
  createdAt: new Date("2026-09-28T11:00:00Z"),
  ...overrides,
});

describe("HTTP trigger ExecutionsTable", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-28T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders an empty state when the trigger never ran", () => {
    // Act
    render(<ExecutionsTable triggerId="trigger-1" executions={[]} />);

    // Assert
    expect(screen.getByText("No executions yet")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("renders statuses, counts and links for each execution", () => {
    // Setup
    const executions = [
      createMockExecution({
        id: "ex-7",
        runStatus: "failed",
        enqueueStatus: "success",
        jobsCreated: 4,
        jobsEnqueued: 4,
        succeededInvocationCount: 3,
        failedInvocationCount: 1,
      }),
    ];

    // Act
    render(<ExecutionsTable triggerId="trigger-1" executions={executions} />);

    // Assert
    const expectedHref = "/dashboard/http-triggers/trigger-1/executions/ex-7";

    expect(screen.getByText("failed")).toHaveAttribute(
      "data-variant",
      "destructive",
    );
    expect(screen.getByText("success")).toHaveAttribute(
      "data-variant",
      "success",
    );
    expect(screen.getByTitle("4 created, 4 enqueued")).toBeInTheDocument();
    expect(screen.getByTitle("3 succeeded, 1 failed")).toBeInTheDocument();
    expect(
      screen.getByRole("link", {
        name: "Open execution from Sep 28, 11:00 1h ago",
      }),
    ).toHaveAttribute("href", expectedHref);
    expect(screen.getByRole("link", { name: "View" })).toHaveAttribute(
      "href",
      expectedHref,
    );
  });

  it("offers cancel only while an execution is pending or running", () => {
    // Setup
    const executions = [
      createMockExecution({ id: "ex-pending", runStatus: "pending" }),
      createMockExecution({ id: "ex-cancelled", runStatus: "cancelled" }),
    ];

    // Act
    render(<ExecutionsTable triggerId="trigger-1" executions={executions} />);

    // Assert
    const [, pendingRow, cancelledRow] = screen.getAllByRole("row");

    expect(
      within(pendingRow as HTMLElement).getByRole("button", {
        name: "Cancel run",
      }),
    ).toBeInTheDocument();
    expect(
      within(cancelledRow as HTMLElement).queryByRole("button", {
        name: "Cancel run",
      }),
    ).not.toBeInTheDocument();
  });
});
