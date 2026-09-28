import React from "react";
import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ScheduleExecutionRow } from "@/lib/schedules";

import { ExecutionsTable } from "./executions-table";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const createMockExecution = (
  overrides?: Partial<ScheduleExecutionRow>,
): ScheduleExecutionRow => ({
  id: "ex-1",
  executionTime: new Date("2026-09-28T11:55:00Z"),
  enqueueStatus: "success",
  runStatus: "succeeded",
  jobsCreated: 2,
  jobsEnqueued: 2,
  succeededInvocationCount: 2,
  failedInvocationCount: 0,
  createdAt: new Date("2026-09-28T11:55:00Z"),
  ...overrides,
});

describe("ExecutionsTable", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-28T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders column headers", () => {
    // Act
    render(
      <ExecutionsTable
        scheduleId="sched-1"
        executions={[createMockExecution()]}
      />,
    );

    // Assert
    const headers = screen
      .getAllByRole("columnheader")
      .map((header) => header.textContent);

    expect(headers).toEqual([
      "Started",
      "Run",
      "Enqueue",
      "Jobs",
      "Invocations",
      "Actions",
    ]);
  });

  it("renders an empty state when there are no executions", () => {
    // Act
    render(<ExecutionsTable scheduleId="sched-1" executions={[]} />);

    // Assert
    expect(screen.getByText("No executions yet")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("renders run and enqueue statuses as badges with counts", () => {
    // Setup
    const executions = [
      createMockExecution({
        enqueueStatus: "partial",
        runStatus: "running",
        jobsCreated: 3,
        jobsEnqueued: 2,
        succeededInvocationCount: 1,
        failedInvocationCount: 1,
      }),
    ];

    // Act
    render(<ExecutionsTable scheduleId="sched-1" executions={executions} />);

    // Assert
    const runBadge = screen.getByText("running");
    const enqueueBadge = screen.getByText("partial");

    expect(runBadge).toHaveAttribute("data-variant", "info");
    expect(enqueueBadge).toHaveAttribute("data-variant", "warning");
    expect(screen.getByTitle("3 created, 2 enqueued")).toHaveTextContent(
      "3 / 2",
    );
    expect(screen.getByTitle("1 succeeded, 1 failed")).toHaveTextContent(
      "1 / 1",
    );
  });

  it("links the execution time and View to the execution page", () => {
    // Setup
    const executions = [createMockExecution({ id: "ex-99" })];

    // Act
    render(<ExecutionsTable scheduleId="sched-1" executions={executions} />);

    // Assert
    const timeLink = screen.getByRole("link", {
      name: "Open execution from Sep 28, 11:55 5m ago",
    });
    const viewLink = screen.getByRole("link", { name: "View" });

    expect(timeLink).toHaveAttribute(
      "href",
      "/dashboard/schedules/sched-1/executions/ex-99",
    );
    expect(viewLink).toHaveAttribute(
      "href",
      "/dashboard/schedules/sched-1/executions/ex-99",
    );
  });

  it("offers cancel only for executions that are still running", () => {
    // Setup
    const executions = [
      createMockExecution({ id: "ex-running", runStatus: "running" }),
      createMockExecution({ id: "ex-done", runStatus: "succeeded" }),
    ];

    // Act
    render(<ExecutionsTable scheduleId="sched-1" executions={executions} />);

    // Assert
    const [, runningRow, finishedRow] = screen.getAllByRole("row");

    expect(
      within(runningRow as HTMLElement).getByRole("button", {
        name: "Cancel run",
      }),
    ).toBeInTheDocument();
    expect(
      within(finishedRow as HTMLElement).queryByRole("button", {
        name: "Cancel run",
      }),
    ).not.toBeInTheDocument();
  });
});
