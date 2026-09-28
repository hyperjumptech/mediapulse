import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const getScheduleExecutionsPageMock = vi.fn();

vi.mock("@/lib/require-dashboard-admin", () => ({
  withDashboardAdmin: <Value,>(load: Promise<Value>) => load,
  requireDashboardAdmin: async () => ({
    id: "u1",
    name: "U",
    email: "u@example.com",
    credentialVersion: 0,
  }),
}));

vi.mock("@/lib/schedules", () => ({
  getScheduleExecutionsPage: (...args: unknown[]) =>
    getScheduleExecutionsPageMock(...args),
}));

vi.mock("./executions-table", () => ({
  ExecutionsTable: ({
    scheduleId,
    executions,
  }: {
    scheduleId: string;
    executions: unknown[];
  }) => (
    <div
      data-testid="executions-table"
      data-schedule-id={scheduleId}
      data-count={executions.length}
    />
  ),
}));

vi.mock("@/components/list-pagination", () => ({
  ListPagination: ({
    basePath,
    page,
    pageSize,
    total,
  }: {
    basePath: string;
    page: number;
    pageSize: number;
    total: number;
  }) => (
    <nav
      data-testid="executions-pagination"
      data-base-path={basePath}
      data-page={page}
      data-page-size={pageSize}
      data-total={total}
    />
  ),
}));

import { ScheduleExecutionsSection } from "./schedule-executions-section";

describe("ScheduleExecutionsSection", () => {
  afterEach(() => {
    getScheduleExecutionsPageMock.mockReset();
  });

  it("renders the executions table and pagination from the loader", async () => {
    // Setup
    getScheduleExecutionsPageMock.mockResolvedValue({
      executions: [{ id: "execution-1" }],
      total: 11,
      page: 2,
      pageSize: 10,
    });

    // Act
    render(
      await ScheduleExecutionsSection({
        scheduleId: "sched-1",
        page: 2,
        pageSize: 10,
      }),
    );

    // Assert
    const table = screen.getByTestId("executions-table");
    const pagination = screen.getByTestId("executions-pagination");

    expect(getScheduleExecutionsPageMock).toHaveBeenCalledWith(
      "sched-1",
      2,
      10,
    );
    expect(table).toHaveAttribute("data-schedule-id", "sched-1");
    expect(table).toHaveAttribute("data-count", "1");
    expect(pagination).toHaveAttribute(
      "data-base-path",
      "/dashboard/schedules/sched-1",
    );
    expect(pagination).toHaveAttribute("data-page", "2");
    expect(pagination).toHaveAttribute("data-page-size", "10");
    expect(pagination).toHaveAttribute("data-total", "11");
  });
});
