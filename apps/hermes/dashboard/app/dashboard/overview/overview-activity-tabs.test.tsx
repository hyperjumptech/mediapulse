import React from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { OverviewActivity } from "@/lib/dashboard-overview";
import type { ExecutionListRow } from "@/lib/execution-list";

import { OverviewActivityTabs } from "./overview-activity-tabs";

const now = new Date("2026-09-28T12:00:00.000Z");

const runningScheduleRun: ExecutionListRow = {
  id: "schedule-execution-1",
  source: "schedule",
  sourceId: "schedule-1",
  sourceName: "Morning digest",
  pipelineName: "Newsletter",
  executionTime: new Date("2026-09-28T11:57:00.000Z"),
  runStatus: "running",
  enqueueStatus: "success",
  succeededInvocationCount: 2,
  failedInvocationCount: 0,
  elapsedLabel: "3m 4s",
};

const pendingManualRun: ExecutionListRow = {
  ...runningScheduleRun,
  id: "manual-execution-1",
  source: "manual",
  sourceId: "pipeline-2",
  sourceName: null,
  pipelineName: "Backfill",
  executionTime: new Date("2026-09-28T10:00:00.000Z"),
  runStatus: "pending",
  succeededInvocationCount: null,
  failedInvocationCount: null,
  elapsedLabel: null,
};

const failedTriggerRun: ExecutionListRow = {
  ...runningScheduleRun,
  id: "trigger-execution-1",
  source: "http-trigger",
  sourceId: "trigger-1",
  sourceName: "Inbound webhook",
  pipelineName: "Ingest",
  executionTime: new Date("2026-09-27T12:00:00.000Z"),
  runStatus: "failed",
};

const partialScheduleRun: ExecutionListRow = {
  ...runningScheduleRun,
  id: "schedule-execution-2",
  executionTime: new Date("2026-09-25T12:00:00.000Z"),
  runStatus: "partial",
};

const emptyActivity: OverviewActivity = {
  running: { rows: [], hasMore: false },
  failed: { rows: [], hasMore: false },
  upcoming: { rows: [], hasMore: false },
};

const activity: OverviewActivity = {
  running: { rows: [runningScheduleRun, pendingManualRun], hasMore: false },
  failed: { rows: [failedTriggerRun, partialScheduleRun], hasMore: true },
  upcoming: {
    rows: [
      {
        id: "schedule-1",
        name: "Morning digest",
        nextRunAt: new Date("2026-09-28T12:12:00.000Z"),
        pipeline: { id: "pipeline-1", name: "Newsletter", isActive: true },
      },
      {
        id: "schedule-2",
        name: "Nightly sweep",
        nextRunAt: new Date("2026-09-28T17:00:00.000Z"),
        pipeline: { id: "pipeline-2", name: "Knowledge base", isActive: false },
      },
    ],
    hasMore: false,
  },
};

const noSavedColumns = { running: {}, failed: {}, upcoming: {} };

const renderTabs = (overviewActivity: OverviewActivity = activity) =>
  render(
    <OverviewActivityTabs
      activity={overviewActivity}
      columnVisibility={noSavedColumns}
    />,
  );

const activePanel = () => screen.getByRole("tabpanel");

const activeTable = () => within(activePanel()).getByRole("table");

const bodyRows = () =>
  within(activeTable()).getAllByRole("row").slice(1) as HTMLElement[];

const showView = async (name: RegExp) => {
  await act(async () => {
    fireEvent.mouseDown(screen.getByRole("tab", { name }));
  });
};

describe("OverviewActivityTabs", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(now);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("puts the view tabs on the table toolbar with a count on each tab", () => {
    renderTabs();

    const tabList = within(activePanel()).getByRole("tablist");
    const tabNames = within(tabList)
      .getAllByRole("tab")
      .map((tab) => tab.textContent);

    expect(tabNames).toEqual(["Running 2", "Failed (7d) 2+", "Upcoming 2"]);
    expect(
      within(activePanel()).getByRole("button", { name: "Customize columns" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "View" })).toHaveTextContent(
      "Running",
    );
  });

  it("lists running executions with their pipeline, source and duration", () => {
    renderTabs();

    const [scheduleRow, manualRow] = bodyRows();

    expect(
      within(scheduleRow as HTMLElement).getByRole("link", {
        name: /Open execution from/,
      }),
    ).toHaveAttribute(
      "href",
      "/dashboard/schedules/schedule-1/executions/schedule-execution-1",
    );
    expect(scheduleRow).toHaveTextContent("Newsletter");
    expect(
      within(scheduleRow as HTMLElement).getByRole("link", {
        name: "Morning digest",
      }),
    ).toHaveAttribute("href", "/dashboard/schedules/schedule-1");
    expect(scheduleRow).toHaveTextContent("3m 4s");
    expect(
      within(scheduleRow as HTMLElement).getByText("running"),
    ).toHaveAttribute("data-tone", "progress");
    expect(manualRow).toHaveTextContent("Manual");
    expect(
      within(manualRow as HTMLElement).getByRole("link", {
        name: /Open execution from/,
      }),
    ).toHaveAttribute(
      "href",
      "/dashboard/pipelines/pipeline-2/executions/manual-execution-1",
    );
  });

  it("shows recent failures on the Failed tab", async () => {
    renderTabs();

    await showView(/^Failed/);

    const [triggerRow, partialRow] = bodyRows();

    expect(
      within(triggerRow as HTMLElement).getByRole("link", {
        name: /Open execution from/,
      }),
    ).toHaveAttribute(
      "href",
      "/dashboard/http-triggers/trigger-1/executions/trigger-execution-1",
    );
    expect(
      within(triggerRow as HTMLElement).getByText("failed"),
    ).toHaveAttribute("data-tone", "failed");
    expect(
      within(partialRow as HTMLElement).getByText("partial"),
    ).toHaveAttribute("data-tone", "warning");
  });

  it("lists upcoming schedules with their next run and pipeline status", async () => {
    renderTabs();

    await showView(/^Upcoming/);

    const [activeRow, disabledRow] = bodyRows();
    const nextRun = within(activeRow as HTMLElement)
      .getByText("in 12m")
      .closest("time");

    expect(
      within(activeRow as HTMLElement).getByRole("link", {
        name: "Morning digest",
      }),
    ).toHaveAttribute("href", "/dashboard/schedules/schedule-1");
    expect(activeRow).toHaveTextContent("Newsletter");
    expect(nextRun).toHaveAttribute("dateTime", "2026-09-28T12:12:00.000Z");
    expect(
      within(activeRow as HTMLElement).getByText("enabled"),
    ).toHaveAttribute("data-tone", "success");
    expect(
      within(disabledRow as HTMLElement).getByText("Pipeline disabled"),
    ).toHaveAttribute("data-tone", "muted");
    expect(
      within(activeRow as HTMLElement).queryByText("Pipeline disabled"),
    ).not.toBeInTheDocument();
  });

  it("keeps an empty state and the tabs for each empty view", async () => {
    renderTabs(emptyActivity);

    const tabNames = screen
      .getAllByRole("tab")
      .map((tab) => tab.textContent?.trim());

    expect(tabNames).toEqual(["Running", "Failed (7d)", "Upcoming"]);
    expect(
      within(activePanel()).getByText("Nothing is running right now"),
    ).toBeInTheDocument();

    await showView(/^Failed/);

    expect(
      within(activePanel()).getByText("No failed runs in the last 7 days"),
    ).toBeInTheDocument();

    await showView(/^Upcoming/);

    expect(
      within(activePanel()).getByText("No upcoming runs"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("keeps keyboard focus on the tabs when the view changes", async () => {
    renderTabs();

    await act(async () => {
      screen.getByRole("tab", { name: /^Failed/ }).focus();
    });

    const failedTab = screen.getByRole("tab", { name: /^Failed/ });

    expect(failedTab).toHaveAttribute("data-state", "active");
    expect(failedTab).toHaveFocus();
    expect(activePanel()).toContainElement(failedTab);
  });
});
