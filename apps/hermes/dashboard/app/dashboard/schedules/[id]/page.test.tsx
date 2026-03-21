import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const getScheduleByIdMock = vi.fn();
const getScheduleExecutionsPageMock = vi.fn();
const getPipelinesWithStepsMock = vi.fn();
const notFoundMock = vi.fn();

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
  notFound: () => notFoundMock(),
}));

vi.mock("@/lib/schedules", () => ({
  getScheduleById: (...args: unknown[]) => getScheduleByIdMock(...args),
  getScheduleExecutionsPage: (...args: unknown[]) =>
    getScheduleExecutionsPageMock(...args),
}));

vi.mock("@/lib/pipelines", () => ({
  getPipelinesWithSteps: () => getPipelinesWithStepsMock(),
}));

vi.mock("@/lib/validate-pipeline", () => ({
  getPipelinesValidationMap: vi.fn().mockResolvedValue({}),
}));

vi.mock("@workspace/orchestration-database", () => ({ prisma: {} }));

vi.mock("./schedule-detail-content", () => ({
  ScheduleDetailContent: ({
    schedule,
    executions,
    totalExecutions,
    currentPage,
    pageSize,
  }: {
    schedule: { id: string; name: string };
    executions: unknown[];
    totalExecutions: number;
    currentPage: number;
    pageSize: number;
  }) => (
    <div
      data-testid="schedule-detail-content"
      data-schedule-name={schedule.name}
      data-executions-count={executions.length}
      data-total={totalExecutions}
      data-page={currentPage}
      data-page-size={pageSize}
    >
      Schedule Detail
    </div>
  ),
}));

vi.mock("@/components/with-auth-protection", () => ({
  withAuthProtection: <P extends Record<string, unknown>>(
    Component: (props: P) => React.ReactNode,
  ) => Component,
}));

import ScheduleDetailPage from "./page";

describe("ScheduleDetailPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    getScheduleByIdMock.mockReset();
    getScheduleExecutionsPageMock.mockReset();
    getPipelinesWithStepsMock.mockReset();
    notFoundMock.mockReset();
  });

  it("renders schedule detail content when schedule exists", async () => {
    getScheduleByIdMock.mockResolvedValue({
      id: "sched-1",
      name: "Daily Run",
      pipeline: { id: "p1", name: "Pipeline" },
    });
    getScheduleExecutionsPageMock.mockResolvedValue({
      executions: [],
      total: 0,
      page: 1,
      pageSize: 15,
    });
    getPipelinesWithStepsMock.mockResolvedValue([]);

    const component = await ScheduleDetailPage({
      params: Promise.resolve({ id: "sched-1" }),
      searchParams: Promise.resolve({}),
    });
    render(component);

    expect(screen.getByTestId("schedule-detail-content")).toBeInTheDocument();
    expect(screen.getByTestId("schedule-detail-content")).toHaveAttribute(
      "data-schedule-name",
      "Daily Run",
    );
  });

  it("passes pagination from searchParams to content", async () => {
    getScheduleByIdMock.mockResolvedValue({
      id: "sched-1",
      name: "Test",
      pipeline: { id: "p1", name: "P" },
    });
    getScheduleExecutionsPageMock.mockResolvedValue({
      executions: [{ id: "ex-1" }],
      total: 1,
      page: 2,
      pageSize: 10,
    });
    getPipelinesWithStepsMock.mockResolvedValue([]);

    const component = await ScheduleDetailPage({
      params: Promise.resolve({ id: "sched-1" }),
      searchParams: Promise.resolve({ page: "2", size: "10" }),
    });
    render(component);

    expect(screen.getByTestId("schedule-detail-content")).toHaveAttribute(
      "data-page",
      "2",
    );
    expect(screen.getByTestId("schedule-detail-content")).toHaveAttribute(
      "data-page-size",
      "10",
    );
  });

  it("calls notFound when schedule does not exist", async () => {
    getScheduleByIdMock.mockResolvedValue(null);
    getScheduleExecutionsPageMock.mockResolvedValue({
      executions: [],
      total: 0,
      page: 1,
      pageSize: 15,
    });
    getPipelinesWithStepsMock.mockResolvedValue([]);

    await ScheduleDetailPage({
      params: Promise.resolve({ id: "missing" }),
      searchParams: Promise.resolve({}),
    });

    expect(notFoundMock).toHaveBeenCalled();
  });
});
