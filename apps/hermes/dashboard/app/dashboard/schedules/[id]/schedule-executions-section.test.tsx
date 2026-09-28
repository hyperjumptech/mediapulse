import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const getScheduleExecutionsPageMock = vi.fn();
const readColumnVisibilityMock = vi.fn();

vi.mock("@/lib/require-dashboard-admin", () => ({
  withDashboardAdmin: <Value,>(load: Promise<Value>) => load,
}));

vi.mock("@/lib/schedules", () => ({
  getScheduleExecutionsPage: (...args: unknown[]) =>
    getScheduleExecutionsPageMock(...args),
}));

vi.mock("@/lib/data-table/read-column-visibility", () => ({
  readColumnVisibility: (...args: unknown[]) =>
    readColumnVisibilityMock(...args),
}));

vi.mock("@/components/executions/executions-data-table", () => ({
  ExecutionsDataTable: (props: Record<string, unknown>) => (
    <div
      data-testid="executions-data-table"
      data-props={JSON.stringify(props)}
    />
  ),
}));

import { ScheduleExecutionsSection } from "./schedule-executions-section";

const renderedProps = () =>
  JSON.parse(
    screen.getByTestId("executions-data-table").getAttribute("data-props") ??
      "{}",
  );

const executionRow = {
  id: "execution-1",
  source: "schedule",
  sourceId: "sched-1",
  sourceName: null,
  executionTime: new Date("2026-09-27T10:00:00.000Z"),
  enqueueStatus: "success",
  runStatus: "succeeded",
  jobsCreated: 2,
  jobsEnqueued: 2,
  succeededInvocationCount: 2,
  failedInvocationCount: 0,
  createdAt: new Date("2026-09-27T10:00:00.000Z"),
  elapsedLabel: "1m 5s",
};

describe("ScheduleExecutionsSection", () => {
  afterEach(() => {
    getScheduleExecutionsPageMock.mockReset();
    readColumnVisibilityMock.mockReset();
  });

  it("renders the shared executions table paged under the schedule", async () => {
    getScheduleExecutionsPageMock.mockResolvedValue({
      executions: [executionRow],
      total: 11,
      page: 2,
      pageSize: 10,
    });
    readColumnVisibilityMock.mockResolvedValue({ duration: false });

    render(
      await ScheduleExecutionsSection({
        scheduleId: "sched-1",
        page: 2,
        pageSize: 10,
      }),
    );

    expect(getScheduleExecutionsPageMock).toHaveBeenCalledWith(
      "sched-1",
      2,
      10,
    );
    expect(readColumnVisibilityMock).toHaveBeenCalledWith(
      "schedule-executions",
    );
    expect(renderedProps()).toEqual({
      title: "Executions",
      tableId: "schedule-executions",
      rows: [
        {
          id: "execution-1",
          source: "schedule",
          sourceId: "sched-1",
          sourceName: null,
          pipelineName: null,
          executionTime: "2026-09-27T10:00:00.000Z",
          runStatus: "succeeded",
          enqueueStatus: "success",
          succeededInvocationCount: 2,
          failedInvocationCount: 0,
          elapsedLabel: "1m 5s",
        },
      ],
      omitColumns: ["pipeline", "source"],
      urlState: {
        basePath: "/dashboard/schedules/sched-1",
        page: 2,
        pageSize: 10,
        total: 11,
        sortDir: "desc",
      },
      paginationLabel: "Schedule executions pagination",
      emptyDescription:
        "Each time this schedule fires, its run shows up here with job and invocation counts.",
      initialColumnVisibility: { duration: false },
    });
  });

  it("uses the page the route already started loading", async () => {
    const executionsPage = Promise.resolve({
      executions: [],
      total: 0,
      page: 1,
      pageSize: 15,
    });
    readColumnVisibilityMock.mockResolvedValue({});

    render(
      await ScheduleExecutionsSection({
        scheduleId: "sched-1",
        page: 1,
        pageSize: 15,
        executionsPage,
      }),
    );

    expect(getScheduleExecutionsPageMock).not.toHaveBeenCalled();
    expect(renderedProps().rows).toEqual([]);
  });
});
