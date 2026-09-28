import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const getSchedulesPageMock = vi.fn();
const getPipelineOptionsWithValidationMock = vi.fn();
const readColumnVisibilityMock = vi.fn();

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

vi.mock("@/lib/data-table/read-column-visibility", () => ({
  readColumnVisibility: (...args: unknown[]) =>
    readColumnVisibilityMock(...args),
}));

vi.mock("./schedules-with-modal", () => ({
  SchedulesWithModal: ({
    schedules,
    pipelines,
    pipelineValidationById,
    urlState,
    initialColumnVisibility,
  }: {
    schedules: Array<{ id: string }>;
    pipelines: Array<{ id: string }>;
    pipelineValidationById: Record<string, { valid: boolean }>;
    urlState: Record<string, unknown>;
    initialColumnVisibility: Record<string, boolean>;
  }) => (
    <div
      data-testid="schedules-with-modal"
      data-schedules-count={schedules.length}
      data-pipelines-count={pipelines.length}
      data-validation-keys={Object.keys(pipelineValidationById).join(",")}
      data-url-state={JSON.stringify(urlState)}
      data-visibility={JSON.stringify(initialColumnVisibility)}
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
    readColumnVisibilityMock.mockReset();
  });

  it("hands the table its rows, pipelines, URL state and saved column choices", async () => {
    getSchedulesPageMock.mockResolvedValue({
      schedules: [{ id: "1", name: "Daily" }],
      total: 31,
      page: 2,
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
    readColumnVisibilityMock.mockResolvedValue({ repeats: false });

    render(await SchedulesSection({ ...baseQuery, page: 2, search: "daily" }));

    const section = screen.getByTestId("schedules-with-modal");

    expect(readColumnVisibilityMock).toHaveBeenCalledWith("schedules");
    expect(section).toHaveAttribute("data-schedules-count", "1");
    expect(section).toHaveAttribute("data-pipelines-count", "2");
    expect(section).toHaveAttribute(
      "data-validation-keys",
      "pipeline-1,pipeline-2",
    );
    expect(section).toHaveAttribute(
      "data-url-state",
      JSON.stringify({
        basePath: "/dashboard/schedules",
        page: 2,
        pageSize: 15,
        total: 31,
        search: "daily",
        sortBy: "name",
        sortDir: "asc",
      }),
    );
    expect(section).toHaveAttribute(
      "data-visibility",
      JSON.stringify({ repeats: false }),
    );
  });

  it("forwards search and sort to getSchedulesPage", async () => {
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
    readColumnVisibilityMock.mockResolvedValue({});

    render(
      await SchedulesSection({
        page: 2,
        pageSize: 10,
        search: "daily",
        sortBy: "nextRunAt",
        sortDir: "desc",
      }),
    );

    expect(getSchedulesPageMock).toHaveBeenCalledWith(2, 10, {
      search: "daily",
      sortBy: "nextRunAt",
      sortDir: "desc",
    });
  });
});
