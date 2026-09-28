import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  getActiveExecutions,
  OverviewExecution,
} from "@/lib/dashboard-overview";

const getActiveExecutionsMock = vi.fn<typeof getActiveExecutions>();

vi.mock("@/lib/require-dashboard-admin", () => ({
  withDashboardAdmin: <Value,>(load: Promise<Value>) => load,
}));

vi.mock("@/lib/dashboard-overview", () => ({
  getActiveExecutions: () => getActiveExecutionsMock(),
}));

import { ActiveExecutionsSection } from "./active-executions-section";

const now = new Date("2026-09-28T12:00:00.000Z");

const scheduleExecution: OverviewExecution = {
  kind: "schedule",
  executionId: "schedule-execution-1",
  parentId: "schedule-1",
  parentName: "Morning digest",
  pipelineId: "pipeline-1",
  pipelineName: "Newsletter",
  runStatus: "running",
  executionTime: new Date("2026-09-28T11:57:00.000Z"),
  href: "/dashboard/schedules/schedule-1/executions/schedule-execution-1",
};

const manualExecution: OverviewExecution = {
  kind: "manual",
  executionId: "manual-execution-1",
  parentId: "pipeline-2",
  parentName: "Backfill",
  pipelineId: "pipeline-2",
  pipelineName: "Backfill",
  runStatus: "pending",
  executionTime: new Date("2026-09-28T10:00:00.000Z"),
  href: "/dashboard/pipelines/pipeline-2/executions/manual-execution-1",
};

describe("ActiveExecutionsSection", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(now);
  });

  afterEach(() => {
    vi.useRealTimers();
    getActiveExecutionsMock.mockReset();
  });

  it("renders each active execution with status, pipeline, source, and start time", async () => {
    // Setup
    getActiveExecutionsMock.mockResolvedValue([
      scheduleExecution,
      manualExecution,
    ]);

    // Act
    render(await ActiveExecutionsSection());

    // Assert
    const links = screen.getAllByRole("link");
    const runningBadge = screen.getByText("running");
    const pendingBadge = screen.getByText("pending");

    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute(
      "href",
      "/dashboard/schedules/schedule-1/executions/schedule-execution-1",
    );
    expect(links[0]).toHaveTextContent("Newsletter");
    expect(links[0]).toHaveTextContent("Schedule: Morning digest");
    expect(links[0]).toHaveTextContent("3m ago");
    expect(runningBadge).toHaveAttribute("data-variant", "info");
    expect(links[1]).toHaveAttribute(
      "href",
      "/dashboard/pipelines/pipeline-2/executions/manual-execution-1",
    );
    expect(links[1]).toHaveTextContent("Manual run");
    expect(links[1]).toHaveTextContent("2h ago");
    expect(pendingBadge).toHaveAttribute("data-variant", "muted");
  });

  it("shows the absolute start time as a tooltip on the relative time", async () => {
    // Setup
    getActiveExecutionsMock.mockResolvedValue([scheduleExecution]);

    // Act
    render(await ActiveExecutionsSection());

    // Assert
    const startTime = screen.getByText("3m ago");

    expect(startTime.tagName).toBe("TIME");
    expect(startTime).toHaveAttribute("dateTime", "2026-09-28T11:57:00.000Z");
    expect(startTime.getAttribute("title")).toMatch(/UTC$/);
  });

  it("renders an empty state when nothing is running", async () => {
    // Setup
    getActiveExecutionsMock.mockResolvedValue([]);

    // Act
    render(await ActiveExecutionsSection());

    // Assert
    expect(
      screen.getByText("Nothing is running right now."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
