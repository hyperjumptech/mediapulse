import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { OverviewActivity } from "@/lib/dashboard-overview";
import type { ColumnVisibility } from "@/lib/data-table/column-visibility";

const getOverviewActivityMock =
  vi.fn<(failuresSince: Date) => Promise<OverviewActivity>>();
const readColumnVisibilityMock =
  vi.fn<(tableId: string) => Promise<ColumnVisibility>>();

vi.mock("@/lib/require-dashboard-admin", () => ({
  withDashboardAdmin: <Value,>(load: Promise<Value>) => load,
}));

vi.mock("@/lib/dashboard-overview", () => ({
  getOverviewActivity: (failuresSince: Date) =>
    getOverviewActivityMock(failuresSince),
}));

vi.mock("@/lib/data-table/read-column-visibility", () => ({
  readColumnVisibility: (tableId: string) => readColumnVisibilityMock(tableId),
}));

import { OverviewActivitySection } from "./overview-activity-section";

const now = new Date("2026-09-28T12:00:00.000Z");

const activity: OverviewActivity = {
  running: {
    rows: [
      {
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
        elapsedLabel: "3m",
      },
    ],
    hasMore: false,
  },
  failed: { rows: [], hasMore: false },
  upcoming: { rows: [], hasMore: false },
};

describe("OverviewActivitySection", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(now);
  });

  afterEach(() => {
    vi.useRealTimers();
    getOverviewActivityMock.mockReset();
    readColumnVisibilityMock.mockReset();
  });

  it("loads failures from the last 7 days and each table's saved columns", async () => {
    getOverviewActivityMock.mockResolvedValue(activity);
    readColumnVisibilityMock.mockImplementation(
      async (tableId): Promise<ColumnVisibility> =>
        tableId === "overview-running" ? { source: false } : {},
    );

    render(await OverviewActivitySection());

    const runningTable = within(screen.getByRole("tabpanel")).getByRole(
      "table",
    );
    const headers = within(runningTable)
      .getAllByRole("columnheader")
      .map((header) => header.textContent);

    expect(getOverviewActivityMock).toHaveBeenCalledWith(
      new Date("2026-09-21T12:00:00.000Z"),
    );
    expect(
      readColumnVisibilityMock.mock.calls.map(([tableId]) => tableId),
    ).toEqual(["overview-running", "overview-failed", "overview-upcoming"]);
    expect(headers).not.toContain("Source");
    expect(
      within(runningTable).getByRole("link", { name: /Open execution from/ }),
    ).toHaveAttribute(
      "href",
      "/dashboard/schedules/schedule-1/executions/schedule-execution-1",
    );
  });
});
