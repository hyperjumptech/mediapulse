import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const getSchedulesPageMock = vi.fn();
const getPipelineOptionsWithValidationMock = vi.fn();

vi.mock("@/lib/require-dashboard-admin", () => ({
  withDashboardAdmin: <Value,>(load: Promise<Value>) => load,
}));

vi.mock("@/lib/schedules", () => ({
  getSchedulesPage: (...args: unknown[]) => getSchedulesPageMock(...args),
}));

vi.mock("@/lib/pipeline-options", () => ({
  getPipelineOptionsWithValidation: () =>
    getPipelineOptionsWithValidationMock(),
}));

vi.mock("./schedules-with-modal", () => ({
  SchedulesWithModal: ({
    schedules,
    pipelines,
    pipelineValidationById,
    searchQuery,
  }: {
    schedules: Array<{ id: string }>;
    pipelines: Array<{ id: string }>;
    pipelineValidationById: Record<string, { valid: boolean }>;
    searchQuery?: string;
  }) => (
    <div
      data-testid="schedules-with-modal"
      data-schedules-count={schedules.length}
      data-pipelines-count={pipelines.length}
      data-validation-keys={Object.keys(pipelineValidationById).join(",")}
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
    getPipelineOptionsWithValidationMock.mockReset();
  });

  it("renders schedules and pipelines from the loaders", async () => {
    // Setup
    getSchedulesPageMock.mockResolvedValue({
      schedules: [{ id: "1", name: "Daily" }],
      total: 1,
      page: 1,
      pageSize: 15,
    });
    getPipelineOptionsWithValidationMock.mockResolvedValue({
      pipelines: [
        { id: "pipeline-1", name: "First", isActive: true },
        { id: "pipeline-2", name: "Second", isActive: false },
      ],
      pipelineValidationById: {
        "pipeline-1": { valid: true, warnings: [] },
        "pipeline-2": { valid: false, warnings: ["Step 1: invalid"] },
      },
    });

    // Act
    render(await SchedulesSection(baseQuery));

    // Assert
    const table = screen.getByTestId("schedules-with-modal");

    expect(table).toHaveAttribute("data-schedules-count", "1");
    expect(table).toHaveAttribute("data-pipelines-count", "2");
    expect(table).toHaveAttribute(
      "data-validation-keys",
      "pipeline-1,pipeline-2",
    );
  });

  it("forwards search and sort to getSchedulesPage", async () => {
    // Setup
    getSchedulesPageMock.mockResolvedValue({
      schedules: [],
      total: 0,
      page: 2,
      pageSize: 10,
    });
    getPipelineOptionsWithValidationMock.mockResolvedValue({
      pipelines: [],
      pipelineValidationById: {},
    });

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
