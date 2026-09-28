import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const getScheduleByIdMock = vi.fn();
const getScheduleExecutionsPageMock = vi.fn().mockResolvedValue({
  executions: [],
  total: 0,
  page: 1,
  pageSize: 15,
});
const getPipelinesWithStepsMock = vi.fn();
const getPipelinesValidationMapMock = vi.fn();
const notFoundMock = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
  notFound: () => notFoundMock(),
}));

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
  getScheduleById: (...args: unknown[]) => getScheduleByIdMock(...args),
  getScheduleExecutionsPage: (...args: unknown[]) =>
    getScheduleExecutionsPageMock(...args),
}));

vi.mock("@/lib/pipelines", () => ({
  getPipelinesWithSteps: () => getPipelinesWithStepsMock(),
}));

vi.mock("@/lib/validate-pipeline", () => ({
  getPipelinesValidationMap: (...args: unknown[]) =>
    getPipelinesValidationMapMock(...args),
}));

vi.mock("@hermes/orchestration-database", () => ({ prisma: {} }));

vi.mock("./schedule-executions-section", () => ({
  ScheduleExecutionsSection: ({
    scheduleId,
    page,
    pageSize,
  }: {
    scheduleId: string;
    page: number;
    pageSize: number;
  }) => (
    <div
      data-testid="schedule-executions-section"
      data-schedule-id={scheduleId}
      data-page={page}
      data-page-size={pageSize}
    />
  ),
}));

vi.mock("./schedule-detail-content", () => ({
  ScheduleDetailContent: ({
    schedule,
    executionsSection,
    pipelines,
    pipelineValidationById,
  }: {
    schedule: { id: string; name: string };
    executionsSection: React.ReactNode;
    pipelines: unknown[];
    pipelineValidationById: Record<string, unknown>;
  }) => (
    <div
      data-testid="schedule-detail-content"
      data-schedule-name={schedule.name}
      data-pipelines-count={pipelines.length}
      data-validation-keys={Object.keys(pipelineValidationById).join(",")}
    >
      Schedule Detail
      {executionsSection}
    </div>
  ),
}));

import ScheduleDetailPage from "./page";

describe("ScheduleDetailPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    getScheduleByIdMock.mockReset();
    getPipelinesWithStepsMock.mockReset();
    getPipelinesValidationMapMock.mockReset();
    notFoundMock.mockReset();
  });

  it("renders schedule detail content when schedule exists", async () => {
    // Setup
    getScheduleByIdMock.mockResolvedValue({
      id: "sched-1",
      name: "Daily Run",
      pipeline: { id: "p1", name: "Pipeline" },
    });
    getPipelinesWithStepsMock.mockResolvedValue([{ id: "p1" }]);
    getPipelinesValidationMapMock.mockResolvedValue({
      p1: { valid: true, warnings: [] },
    });

    // Act
    const component = await ScheduleDetailPage({
      params: Promise.resolve({ id: "sched-1" }),
      searchParams: Promise.resolve({}),
    });
    render(component);

    // Assert
    const content = screen.getByTestId("schedule-detail-content");

    expect(getScheduleByIdMock).toHaveBeenCalledWith("sched-1");
    expect(content).toHaveAttribute("data-schedule-name", "Daily Run");
    expect(content).toHaveAttribute("data-pipelines-count", "1");
    expect(content).toHaveAttribute("data-validation-keys", "p1");
  });

  it("passes pagination from searchParams to the executions section", async () => {
    // Setup
    getScheduleByIdMock.mockResolvedValue({
      id: "sched-1",
      name: "Test",
      pipeline: { id: "p1", name: "P" },
    });
    getPipelinesWithStepsMock.mockResolvedValue([]);
    getPipelinesValidationMapMock.mockResolvedValue({});

    // Act
    const component = await ScheduleDetailPage({
      params: Promise.resolve({ id: "sched-1" }),
      searchParams: Promise.resolve({ page: "2", size: "10" }),
    });
    render(component);

    // Assert
    const executionsSection = screen.getByTestId("schedule-executions-section");

    expect(executionsSection).toHaveAttribute("data-schedule-id", "sched-1");
    expect(executionsSection).toHaveAttribute("data-page", "2");
    expect(executionsSection).toHaveAttribute("data-page-size", "10");
  });

  it("calls notFound when schedule does not exist", async () => {
    // Setup
    getScheduleByIdMock.mockResolvedValue(null);
    getPipelinesWithStepsMock.mockResolvedValue([]);
    notFoundMock.mockImplementation(() => {
      throw new Error("NEXT_NOT_FOUND");
    });

    // Act
    await expect(
      ScheduleDetailPage({
        params: Promise.resolve({ id: "missing" }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");

    // Assert
    expect(notFoundMock).toHaveBeenCalled();
    expect(getPipelinesValidationMapMock).not.toHaveBeenCalled();
  });
});
