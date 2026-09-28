import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  getRecentFailures,
  OverviewExecution,
} from "@/lib/dashboard-overview";

const getRecentFailuresMock = vi.fn<typeof getRecentFailures>();

vi.mock("@/lib/require-dashboard-admin", () => ({
  withDashboardAdmin: <Value,>(load: Promise<Value>) => load,
}));

vi.mock("@/lib/dashboard-overview", () => ({
  getRecentFailures: (since: Date) => getRecentFailuresMock(since),
}));

import { RecentFailuresSection } from "./recent-failures-section";

const now = new Date("2026-09-28T12:00:00.000Z");

const failedTriggerExecution: OverviewExecution = {
  kind: "httpTrigger",
  executionId: "trigger-execution-1",
  parentId: "trigger-1",
  parentName: "Inbound webhook",
  pipelineId: "pipeline-1",
  pipelineName: "Ingest",
  runStatus: "failed",
  executionTime: new Date("2026-09-27T12:00:00.000Z"),
  href: "/dashboard/http-triggers/trigger-1/executions/trigger-execution-1",
};

const partialScheduleExecution: OverviewExecution = {
  kind: "schedule",
  executionId: "schedule-execution-1",
  parentId: "schedule-1",
  parentName: "Morning digest",
  pipelineId: "pipeline-2",
  pipelineName: "Newsletter",
  runStatus: "partial",
  executionTime: new Date("2026-09-25T12:00:00.000Z"),
  href: "/dashboard/schedules/schedule-1/executions/schedule-execution-1",
};

describe("RecentFailuresSection", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(now);
  });

  afterEach(() => {
    vi.useRealTimers();
    getRecentFailuresMock.mockReset();
  });

  it("loads failures from the last 7 days and links each to its execution", async () => {
    // Setup
    getRecentFailuresMock.mockResolvedValue([
      failedTriggerExecution,
      partialScheduleExecution,
    ]);

    // Act
    render(await RecentFailuresSection());

    // Assert
    const links = screen.getAllByRole("link");

    expect(getRecentFailuresMock).toHaveBeenCalledWith(
      new Date("2026-09-21T12:00:00.000Z"),
    );
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute(
      "href",
      "/dashboard/http-triggers/trigger-1/executions/trigger-execution-1",
    );
    expect(links[0]).toHaveTextContent("HTTP trigger: Inbound webhook");
    expect(links[0]).toHaveTextContent("1d ago");
    expect(links[1]).toHaveAttribute(
      "href",
      "/dashboard/schedules/schedule-1/executions/schedule-execution-1",
    );
    expect(links[1]).toHaveTextContent("3d ago");
  });

  it("uses a failed tone for failed runs and a warning tone for partial runs", async () => {
    // Setup
    getRecentFailuresMock.mockResolvedValue([
      failedTriggerExecution,
      partialScheduleExecution,
    ]);

    // Act
    render(await RecentFailuresSection());

    // Assert
    expect(screen.getByText("failed")).toHaveAttribute("data-tone", "failed");
    expect(screen.getByText("partial")).toHaveAttribute("data-tone", "warning");
  });

  it("renders an empty state when nothing failed", async () => {
    // Setup
    getRecentFailuresMock.mockResolvedValue([]);

    // Act
    render(await RecentFailuresSection());

    // Assert
    expect(
      screen.getByText("No failed runs in the last 7 days."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
