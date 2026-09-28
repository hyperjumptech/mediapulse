import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const getHttpTriggersPageMock = vi.fn();
const getPipelineOptionsMock = vi.fn();
const readColumnVisibilityMock = vi.fn();

vi.mock("@/lib/require-dashboard-admin", () => ({
  withDashboardAdmin: <Value,>(load: Promise<Value>) => load,
}));

vi.mock("@/lib/http-triggers", () => ({
  getHttpTriggersPage: (...args: unknown[]) => getHttpTriggersPageMock(...args),
}));

vi.mock("@/lib/pipeline-options", () => ({
  getPipelineOptions: () => getPipelineOptionsMock(),
}));

vi.mock("@/lib/data-table/read-column-visibility", () => ({
  readColumnVisibility: (...args: unknown[]) =>
    readColumnVisibilityMock(...args),
}));

vi.mock("./http-triggers-with-modal", () => ({
  HttpTriggersWithModal: ({
    httpTriggers,
    pipelines,
    urlState,
    initialColumnVisibility,
  }: {
    httpTriggers: Array<{ id: string }>;
    pipelines: Array<{ id: string }>;
    urlState: Record<string, unknown>;
    initialColumnVisibility: Record<string, boolean>;
  }) => (
    <div
      data-testid="http-triggers-with-modal"
      data-triggers-count={httpTriggers.length}
      data-pipelines-count={pipelines.length}
      data-url-state={JSON.stringify(urlState)}
      data-visibility={JSON.stringify(initialColumnVisibility)}
    />
  ),
}));

import { HttpTriggersSection } from "./http-triggers-section";

const baseQuery = {
  page: 1,
  pageSize: 15,
  search: undefined,
  sortBy: "name" as const,
  sortDir: "asc" as const,
};

describe("HttpTriggersSection", () => {
  afterEach(() => {
    getHttpTriggersPageMock.mockReset();
    getPipelineOptionsMock.mockReset();
    readColumnVisibilityMock.mockReset();
  });

  it("hands the table its rows, pipelines, URL state and saved column choices", async () => {
    getHttpTriggersPageMock.mockResolvedValue({
      httpTriggers: [{ id: "trigger-1" }],
      total: 16,
      page: 2,
      pageSize: 15,
    });
    getPipelineOptionsMock.mockResolvedValue([
      { id: "pipeline-1", name: "First", isActive: true },
      { id: "pipeline-2", name: "Second", isActive: true },
    ]);
    readColumnVisibilityMock.mockResolvedValue({ method: false });

    render(
      await HttpTriggersSection({ ...baseQuery, page: 2, search: "webhook" }),
    );

    const section = screen.getByTestId("http-triggers-with-modal");

    expect(readColumnVisibilityMock).toHaveBeenCalledWith("http-triggers");
    expect(section).toHaveAttribute("data-triggers-count", "1");
    expect(section).toHaveAttribute("data-pipelines-count", "2");
    expect(section).toHaveAttribute(
      "data-url-state",
      JSON.stringify({
        basePath: "/dashboard/http-triggers",
        page: 2,
        pageSize: 15,
        total: 16,
        search: "webhook",
        sortBy: "name",
        sortDir: "asc",
      }),
    );
    expect(section).toHaveAttribute(
      "data-visibility",
      JSON.stringify({ method: false }),
    );
  });

  it("forwards search and sort to getHttpTriggersPage", async () => {
    getHttpTriggersPageMock.mockResolvedValue({
      httpTriggers: [],
      total: 0,
      page: 1,
      pageSize: 15,
    });
    getPipelineOptionsMock.mockResolvedValue([]);
    readColumnVisibilityMock.mockResolvedValue({});

    render(
      await HttpTriggersSection({
        ...baseQuery,
        search: "webhook",
        sortBy: "method",
        sortDir: "desc",
      }),
    );

    expect(getHttpTriggersPageMock).toHaveBeenCalledWith(1, 15, {
      search: "webhook",
      sortBy: "method",
      sortDir: "desc",
    });
  });
});
