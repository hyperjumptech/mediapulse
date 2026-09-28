import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SchedulesPageResult } from "@/lib/schedules";

import { SchedulesTable } from "./schedules-table";

type ScheduleRow = SchedulesPageResult["schedules"][number];

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    className,
    "aria-label": ariaLabel,
    "aria-sort": ariaSort,
  }: React.ComponentProps<"a"> & { href: string }) => (
    <a
      href={href}
      className={className}
      aria-label={ariaLabel}
      aria-sort={ariaSort}
    >
      {children}
    </a>
  ),
}));

vi.mock("./schedule-row-actions", () => ({
  ScheduleRowActions: ({
    scheduleId,
    scheduleName,
  }: {
    scheduleId: string;
    scheduleName: string;
  }) => (
    <button
      type="button"
      data-testid={`row-actions-${scheduleId}`}
      data-name={scheduleName}
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
    createdBy: { id: "user-1", name: "Ada Lovelace", email: "ada@example.com" },
    ...overrides,
  }) as ScheduleRow;

const renderTable = (
  props: Partial<React.ComponentProps<typeof SchedulesTable>> = {},
) =>
  render(
    <SchedulesTable
      schedules={[createMockSchedule()]}
      sortBy="name"
      sortDir="asc"
      pageSize={15}
      onEdit={vi.fn()}
      onCreate={vi.fn()}
      {...props}
    />,
  );

describe("SchedulesTable", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(now);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the column headers", () => {
    // Act
    renderTable();

    // Assert
    const headers = screen
      .getAllByRole("columnheader")
      .map((header) => header.textContent);

    expect(headers).toEqual([
      "Name",
      "Pipeline",
      "Repeats",
      "Next run",
      "Status",
      "Created",
      "Created by",
      "Actions",
    ]);
  });

  it("links sort headers to the next direction and resets to page 1", () => {
    // Act
    renderTable({ sortBy: "name", sortDir: "asc", searchQuery: "daily" });

    // Assert
    expect(screen.getByRole("link", { name: "Name" })).toHaveAttribute(
      "href",
      "/dashboard/schedules?page=1&size=15&q=daily&sort=name&dir=desc",
    );
    expect(screen.getByRole("link", { name: "Next run" })).toHaveAttribute(
      "href",
      "/dashboard/schedules?page=1&size=15&q=daily&sort=nextRunAt&dir=asc",
    );
    expect(screen.getByRole("link", { name: "Name" })).toHaveAttribute(
      "aria-sort",
      "ascending",
    );
  });

  it("renders a row with links, cadence, relative times, status, and creator", () => {
    // Act
    renderTable();

    // Assert
    const row = screen.getByRole("row", { name: /Daily Run/ });

    expect(
      within(row).getByRole("link", { name: "Daily Run" }),
    ).toHaveAttribute("href", "/dashboard/schedules/schedule-1");
    expect(
      within(row).getByRole("link", { name: "Test Pipeline" }),
    ).toHaveAttribute("href", "/dashboard/pipelines/pipeline-1");
    expect(within(row).getByText("Every 15m")).toBeInTheDocument();
    expect(within(row).getByText("in 1h")).toHaveAttribute(
      "datetime",
      "2024-01-15T10:00:00.000Z",
    );
    expect(within(row).getByText("3d ago")).toBeInTheDocument();
    expect(within(row).getByText("enabled")).toHaveAttribute(
      "data-variant",
      "success",
    );
    expect(within(row).getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByTestId("row-actions-schedule-1")).toHaveAttribute(
      "data-name",
      "Daily Run",
    );
  });

  it("marks disabled schedules with a muted status", () => {
    // Act
    renderTable({ schedules: [createMockSchedule({ enabled: false })] });

    // Assert
    expect(screen.getByText("disabled")).toHaveAttribute(
      "data-variant",
      "muted",
    );
  });

  it("shows custom cron expressions in monospace with the schedule timezone", () => {
    // Act
    renderTable({
      schedules: [
        createMockSchedule({ interval: null, cronExpression: "0 7 * * 1-5" }),
      ],
    });

    // Assert
    const cron = screen.getByText("0 7 * * 1-5");

    expect(cron.tagName).toBe("CODE");
    expect(cron).toHaveAttribute("title", "Cron in Asia/Jakarta");
  });

  it("displays a dash when there is no next run", () => {
    // Act
    renderTable({ schedules: [createMockSchedule({ nextRunAt: null })] });

    // Assert
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders row actions for each schedule", () => {
    // Act
    renderTable({
      schedules: [
        createMockSchedule({ id: "schedule-1" }),
        createMockSchedule({ id: "schedule-2", name: "Weekly Run" }),
      ],
    });

    // Assert
    expect(screen.getByTestId("row-actions-schedule-1")).toBeInTheDocument();
    expect(screen.getByTestId("row-actions-schedule-2")).toBeInTheDocument();
  });

  it("invites creating the first schedule when there are none", () => {
    // Setup
    const onCreate = vi.fn();
    renderTable({ schedules: [], onCreate });

    // Act
    fireEvent.click(screen.getByRole("button", { name: "New schedule" }));

    // Assert
    expect(screen.getByText("No schedules yet")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it("offers to clear the search when nothing matches", () => {
    // Act
    renderTable({
      schedules: [],
      searchQuery: "daily",
      sortBy: "nextRunAt",
      sortDir: "desc",
      pageSize: 20,
    });

    // Assert
    expect(screen.getByText("No schedules match “daily”")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Clear search" })).toHaveAttribute(
      "href",
      "/dashboard/schedules?page=1&size=20&sort=nextRunAt&dir=desc",
    );
    expect(
      screen.queryByRole("button", { name: "New schedule" }),
    ).not.toBeInTheDocument();
  });
});
