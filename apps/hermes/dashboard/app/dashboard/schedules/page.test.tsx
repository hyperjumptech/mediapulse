import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const getSchedulesPageMock = vi.fn();
const getPipelinesWithStepsMock = vi.fn();

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("@/lib/schedules", () => ({
  getSchedulesPage: (...args: unknown[]) => getSchedulesPageMock(...args),
}));

vi.mock("@/lib/pipelines", () => ({
  getPipelinesWithSteps: () => getPipelinesWithStepsMock(),
}));

vi.mock("@/lib/validate-pipeline", () => ({
  getPipelinesValidationMap: vi.fn().mockResolvedValue({}),
}));

vi.mock("@workspace/orchestration-database", () => ({ prisma: {} }));

vi.mock("./schedules-with-modal", () => ({
  SchedulesWithModal: ({
    schedules,
    pipelines,
  }: {
    schedules: Array<{ id: string }>;
    pipelines: Array<{ id: string }>;
  }) => (
    <div
      data-testid="schedules-with-modal"
      data-schedules-count={schedules.length}
      data-pipelines-count={pipelines.length}
    >
      Schedules
    </div>
  ),
}));

vi.mock("@/components/with-auth-protection", () => ({
  withAuthProtection: <P extends Record<string, unknown>>(
    Component: (props: P) => React.ReactNode,
  ) => Component,
}));

import SchedulesPage from "./page";

describe("SchedulesPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    getSchedulesPageMock.mockReset();
    getPipelinesWithStepsMock.mockReset();
  });

  it("renders schedules with modal when authenticated", async () => {
    // Setup
    getSchedulesPageMock.mockResolvedValue({
      schedules: [{ id: "1", name: "Test Schedule" }],
      total: 1,
      page: 1,
      pageSize: 15,
    });
    getPipelinesWithStepsMock.mockResolvedValue([
      { id: "pipeline-1", name: "Pipeline A" },
    ]);

    // Act
    const component = await SchedulesPage({ searchParams: {} });
    render(component);

    // Assert
    expect(screen.getByTestId("schedules-with-modal")).toBeInTheDocument();
    expect(screen.getByTestId("schedules-with-modal")).toHaveAttribute(
      "data-schedules-count",
      "1",
    );
  });

  it("passes pipelines to schedules with modal", async () => {
    // Setup
    getSchedulesPageMock.mockResolvedValue({
      schedules: [],
      total: 0,
      page: 1,
      pageSize: 15,
    });
    getPipelinesWithStepsMock.mockResolvedValue([
      { id: "pipeline-1" },
      { id: "pipeline-2" },
    ]);

    // Act
    const component = await SchedulesPage({ searchParams: {} });
    render(component);

    // Assert
    expect(screen.getByTestId("schedules-with-modal")).toHaveAttribute(
      "data-pipelines-count",
      "2",
    );
  });

  it("passes search query to getSchedulesPage", async () => {
    // Setup
    getSchedulesPageMock.mockResolvedValue({
      schedules: [],
      total: 0,
      page: 1,
      pageSize: 15,
    });
    getPipelinesWithStepsMock.mockResolvedValue([]);

    // Act
    await SchedulesPage({ searchParams: { q: "daily" } });

    // Assert
    expect(getSchedulesPageMock).toHaveBeenCalledWith(
      1,
      15,
      expect.objectContaining({ search: "daily" }),
    );
  });

  it("parses sort parameters correctly", async () => {
    // Setup
    getSchedulesPageMock.mockResolvedValue({
      schedules: [],
      total: 0,
      page: 1,
      pageSize: 15,
    });
    getPipelinesWithStepsMock.mockResolvedValue([]);

    // Act
    await SchedulesPage({ searchParams: { sort: "nextRunAt", dir: "desc" } });

    // Assert
    expect(getSchedulesPageMock).toHaveBeenCalledWith(
      1,
      15,
      expect.objectContaining({ sortBy: "nextRunAt", sortDir: "desc" }),
    );
  });
});
