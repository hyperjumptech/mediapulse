import React from "react";
import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PipelineExecutionRow } from "@/lib/pipeline-executions";

import { PipelineExecutionsTable } from "./pipeline-executions-table";

const createExecution = (
  overrides?: Partial<PipelineExecutionRow>,
): PipelineExecutionRow => ({
  id: "exec-1",
  source: "manual",
  sourceId: "pipeline-1",
  sourceName: null,
  executionTime: new Date("2026-09-28T11:50:00Z"),
  enqueueStatus: "success",
  runStatus: "succeeded",
  jobsCreated: 2,
  jobsEnqueued: 2,
  succeededInvocationCount: 2,
  failedInvocationCount: 0,
  createdAt: new Date("2026-09-28T11:50:00Z"),
  elapsedLabel: "1m 5s",
  ...overrides,
});

describe("PipelineExecutionsTable", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-28T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders an empty state without executions", () => {
    // Act
    render(<PipelineExecutionsTable pipelineId="pipeline-1" executions={[]} />);

    // Assert
    expect(screen.getByText("No executions yet")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("links each execution to the detail page of its source", () => {
    // Setup
    const executions = [
      createExecution({ id: "manual-1" }),
      createExecution({
        id: "schedule-exec-1",
        source: "schedule",
        sourceId: "schedule-1",
        sourceName: "Nightly digest",
      }),
      createExecution({
        id: "trigger-exec-1",
        source: "http-trigger",
        sourceId: "trigger-1",
        sourceName: "CMS webhook",
      }),
    ];

    // Act
    render(
      <PipelineExecutionsTable
        pipelineId="pipeline-1"
        executions={executions}
      />,
    );

    // Assert
    const viewHrefs = screen
      .getAllByRole("link", { name: "View" })
      .map((link) => link.getAttribute("href"));

    expect(viewHrefs).toEqual([
      "/dashboard/pipelines/pipeline-1/executions/manual-1",
      "/dashboard/schedules/schedule-1/executions/schedule-exec-1",
      "/dashboard/http-triggers/trigger-1/executions/trigger-exec-1",
    ]);
  });

  it("shows a source badge with a link to the named schedule or trigger", () => {
    // Setup
    const executions = [
      createExecution({ id: "manual-1" }),
      createExecution({
        id: "schedule-exec-1",
        source: "schedule",
        sourceId: "schedule-1",
        sourceName: "Nightly digest",
      }),
      createExecution({
        id: "trigger-exec-1",
        source: "http-trigger",
        sourceId: "trigger-1",
        sourceName: "CMS webhook",
      }),
    ];

    // Act
    render(
      <PipelineExecutionsTable
        pipelineId="pipeline-1"
        executions={executions}
      />,
    );

    // Assert
    const [, manualRow, scheduleRow, triggerRow] = screen.getAllByRole("row");

    expect(within(manualRow as HTMLElement).getByText("Manual")).toBeVisible();
    expect(
      within(manualRow as HTMLElement).queryByRole("link", {
        name: "Nightly digest",
      }),
    ).not.toBeInTheDocument();
    expect(
      within(scheduleRow as HTMLElement).getByText("Schedule"),
    ).toBeVisible();
    expect(
      within(scheduleRow as HTMLElement).getByRole("link", {
        name: "Nightly digest",
      }),
    ).toHaveAttribute("href", "/dashboard/schedules/schedule-1");
    expect(
      within(triggerRow as HTMLElement).getByText("Trigger"),
    ).toBeVisible();
    expect(
      within(triggerRow as HTMLElement).getByRole("link", {
        name: "CMS webhook",
      }),
    ).toHaveAttribute("href", "/dashboard/http-triggers/trigger-1");
  });

  it("omits the source link when the source name is unknown", () => {
    // Setup
    const executions = [
      createExecution({
        source: "schedule",
        sourceId: "schedule-1",
        sourceName: null,
      }),
    ];

    // Act
    render(
      <PipelineExecutionsTable
        pipelineId="pipeline-1"
        executions={executions}
      />,
    );

    // Assert
    const [, scheduleRow] = screen.getAllByRole("row");

    expect(
      within(scheduleRow as HTMLElement).getAllByRole("link"),
    ).toHaveLength(2);
  });

  it("renders statuses, counts and elapsed time", () => {
    // Setup
    const executions = [
      createExecution({
        runStatus: "partial",
        enqueueStatus: "failed",
        succeededInvocationCount: 1,
        failedInvocationCount: 1,
      }),
    ];

    // Act
    render(
      <PipelineExecutionsTable
        pipelineId="pipeline-1"
        executions={executions}
      />,
    );

    // Assert
    expect(screen.getByText("partial")).toHaveAttribute(
      "data-variant",
      "warning",
    );
    expect(screen.getByText("failed")).toHaveAttribute(
      "data-variant",
      "destructive",
    );
    expect(screen.getByTitle("1 succeeded, 1 failed")).toBeInTheDocument();
    expect(screen.getByText("1m 5s")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Open execution from 10m ago" }),
    ).toBeInTheDocument();
  });
});
