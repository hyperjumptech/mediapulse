import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const getSchedulesPageMock = vi.fn();
const getPipelinesWithStepsMock = vi.fn();
const getPipelinesValidationMapMock = vi.fn();

vi.mock("@/lib/require-dashboard-admin", () => ({
  withDashboardAdmin: <Value,>(load: Promise<Value>) => load,
}));

vi.mock("@/lib/schedules", () => ({
  getSchedulesPage: (...args: unknown[]) => getSchedulesPageMock(...args),
}));

vi.mock("@/lib/pipelines", () => ({
  getPipelinesWithSteps: () => getPipelinesWithStepsMock(),
}));

vi.mock("@/lib/validate-pipeline", () => ({
  getPipelinesValidationMap: (...args: unknown[]) =>
    getPipelinesValidationMapMock(...args),
}));

vi.mock("@hermes/orchestration-database", () => ({ prisma: {} }));

vi.mock("./schedules-with-modal", () => ({
  SchedulesWithModal: ({
    schedules,
    pipelines,
    searchQuery,
  }: {
    schedules: Array<{ id: string }>;
    pipelines: Array<{ id: string }>;
    searchQuery?: string;
  }) => (
    <div
      data-testid="schedules-with-modal"
      data-schedules-count={schedules.length}
      data-pipelines-count={pipelines.length}
      data-search={searchQuery ?? ""}
    />
  ),
}));

import { SchedulesSection } from "./schedules-section";

const baseQuery = {
  page: 1,
  pageSize: 15,
  search: undefined,
  sortBy: "name" as const,
  sortDir: "asc" as const,
};

describe("SchedulesSection", () => {
  afterEach(() => {
    getSchedulesPageMock.mockReset();
    getPipelinesWithStepsMock.mockReset();
    getPipelinesValidationMapMock.mockReset();
  });

  it("renders schedules and pipelines from the loaders", async () => {
    // Setup
    getSchedulesPageMock.mockResolvedValue({
      schedules: [{ id: "1", name: "Daily" }],
      total: 1,
      page: 1,
      pageSize: 15,
    });
    getPipelinesWithStepsMock.mockResolvedValue([
      { id: "pipeline-1" },
      { id: "pipeline-2" },
    ]);
    getPipelinesValidationMapMock.mockResolvedValue({});

    // Act
    render(await SchedulesSection(baseQuery));

    // Assert
    const table = screen.getByTestId("schedules-with-modal");

    expect(table).toHaveAttribute("data-schedules-count", "1");
    expect(table).toHaveAttribute("data-pipelines-count", "2");
  });

  it("forwards search and sort to getSchedulesPage", async () => {
    // Setup
    getSchedulesPageMock.mockResolvedValue({
      schedules: [],
      total: 0,
      page: 2,
      pageSize: 10,
    });
    getPipelinesWithStepsMock.mockResolvedValue([]);
    getPipelinesValidationMapMock.mockResolvedValue({});

    // Act
    render(
      await SchedulesSection({
        page: 2,
        pageSize: 10,
        search: "daily",
        sortBy: "nextRunAt",
        sortDir: "desc",
      }),
    );

    // Assert
    expect(getSchedulesPageMock).toHaveBeenCalledWith(2, 10, {
      search: "daily",
      sortBy: "nextRunAt",
      sortDir: "desc",
    });
    expect(screen.getByTestId("schedules-with-modal")).toHaveAttribute(
      "data-search",
      "daily",
    );
  });
});
