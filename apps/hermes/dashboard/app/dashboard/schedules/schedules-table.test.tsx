import React from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ListUrlState } from "@/lib/data-table/list-url-state";

import { SchedulesTable, type ScheduleRow } from "./schedules-table";

vi.mock("./schedule-row-actions", () => ({
  ScheduleRowActions: ({
    scheduleId,
    scheduleName,
    onEdit,
  }: {
    scheduleId: string;
    scheduleName: string;
    onEdit: (scheduleId: string) => void;
  }) => (
    <button
      type="button"
      data-testid={`row-actions-${scheduleId}`}
      data-name={scheduleName}
      onClick={() => onEdit(scheduleId)}
    >
      Actions
    </button>
  ),
}));

const now = new Date("2024-01-15T09:00:00.000Z");

const createMockSchedule = (overrides: Partial<ScheduleRow> = {}) =>
  ({
    id: "schedule-1",
    name: "Daily Run",
    description: null,
    repeat: "repeating",
    interval: 15 * 60_000,
    cronExpression: null,
    timezone: "Asia/Jakarta",
    enabled: true,
    nextRunAt: new Date("2024-01-15T10:00:00.000Z"),
    pipeline: { id: "pipeline-1", name: "Test Pipeline" },
    createdAt: new Date("2024-01-12T09:00:00.000Z"),
    createdById: null,
    createdBy: null,
    ...overrides,
  }) as ScheduleRow;

const urlState: ListUrlState = {
  basePath: "/dashboard/schedules",
  page: 1,
  pageSize: 15,
  total: 1,
  sortBy: "name",
  sortDir: "asc",
};

const renderTable = (
  props: Partial<React.ComponentProps<typeof SchedulesTable>> = {},
) =>
  render(
    <SchedulesTable
      schedules={[createMockSchedule()]}
      urlState={urlState}
      onEdit={vi.fn()}
      onCreate={vi.fn()}
      {...props}
    />,
  );

const table = () => screen.getByRole("table");

const openMenu = async (trigger: HTMLElement) => {
  await act(async () => {
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
  });
};

describe("SchedulesTable", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(now);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows name, pipeline, cadence, next run, status and actions", () => {
    renderTable();

    const headers = within(table())
      .getAllByRole("columnheader")
      .map((header) => header.textContent);

    expect(headers).toEqual([
      "Name",
      "Pipeline",
      "Repeats",
      "Next run",
      "Status",
      "Actions",
    ]);
  });

  it("renders a row with links, cadence, next run and status", () => {
    renderTable();

    const row = within(table()).getAllByRole("row")[1] as HTMLElement;

    expect(
      within(row).getByRole("link", { name: "Daily Run" }),
    ).toHaveAttribute("href", "/dashboard/schedules/schedule-1");
    expect(
      within(row).getByRole("link", { name: "Test Pipeline" }),
    ).toHaveAttribute("href", "/dashboard/pipelines/pipeline-1");
    expect(within(row).getByText("Every 15m")).toBeInTheDocument();
    expect(within(row).getByText("in 1h").closest("time")).toHaveAttribute(
      "datetime",
      "2024-01-15T10:00:00.000Z",
    );
    expect(within(row).getByText("enabled")).toHaveAttribute(
      "data-tone",
      "success",
    );
    expect(within(row).getByTestId("row-actions-schedule-1")).toHaveAttribute(
      "data-name",
      "Daily Run",
    );
  });

  it("marks disabled schedules with a muted status", () => {
    renderTable({ schedules: [createMockSchedule({ enabled: false })] });

    expect(within(table()).getByText("disabled")).toHaveAttribute(
      "data-tone",
      "muted",
    );
  });

  it("shows custom cron expressions in monospace with the schedule timezone", () => {
    renderTable({
      schedules: [
        createMockSchedule({ interval: null, cronExpression: "0 7 * * 1-5" }),
      ],
    });

    const cron = within(table()).getByText("0 7 * * 1-5");

    expect(cron.tagName).toBe("CODE");
    expect(cron).toHaveAttribute("title", "Cron in Asia/Jakarta");
  });

  it("displays a dash when there is no next run", () => {
    renderTable({ schedules: [createMockSchedule({ nextRunAt: null })] });

    expect(within(table()).getByText("—")).toBeInTheDocument();
  });

  it("hands the row id to the edit handler", () => {
    const onEdit = vi.fn();
    renderTable({ onEdit });

    fireEvent.click(within(table()).getByTestId("row-actions-schedule-1"));

    expect(onEdit).toHaveBeenCalledWith("schedule-1");
  });

  it("marks the sorted column from the URL state", () => {
    renderTable();

    expect(
      within(table()).getByRole("columnheader", { name: "Name" }),
    ).toHaveAttribute("aria-sort", "ascending");
    expect(
      within(table()).getByRole("columnheader", { name: "Next run" }),
    ).not.toHaveAttribute("aria-sort");
  });

  it("sorts next run by nextRunAt and keeps the search", async () => {
    renderTable({ urlState: { ...urlState, search: "daily" } });

    await openMenu(within(table()).getByRole("button", { name: "Next run" }));

    expect(screen.getByRole("menuitem", { name: "Desc" })).toHaveAttribute(
      "href",
      "/dashboard/schedules?page=1&size=15&q=daily&sort=nextRunAt&dir=desc",
    );
  });

  it("sorts the status column by enabled", async () => {
    renderTable();

    await openMenu(within(table()).getByRole("button", { name: "Status" }));

    expect(screen.getByRole("menuitem", { name: "Asc" })).toHaveAttribute(
      "href",
      "/dashboard/schedules?page=1&size=15&sort=enabled&dir=asc",
    );
  });

  it("invites creating the first schedule when there are none", () => {
    const onCreate = vi.fn();
    renderTable({ schedules: [], onCreate });

    fireEvent.click(screen.getByRole("button", { name: "New schedule" }));

    expect(screen.getByText("No schedules yet")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it("offers to clear the search when nothing matches", () => {
    renderTable({
      schedules: [],
      urlState: {
        ...urlState,
        pageSize: 20,
        search: "daily",
        sortBy: "nextRunAt",
        sortDir: "desc",
      },
    });

    expect(screen.getByText("Nothing matches “daily”")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Clear search" })).toHaveAttribute(
      "href",
      "/dashboard/schedules?page=1&size=20&sort=nextRunAt&dir=desc",
    );
    expect(
      screen.queryByRole("button", { name: "New schedule" }),
    ).not.toBeInTheDocument();
  });

  it("offers the schedule search box", () => {
    renderTable();

    expect(
      screen.getByRole("search", {
        name: "Search schedules by name or description",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Filter schedules…"),
    ).toBeInTheDocument();
  });
});
