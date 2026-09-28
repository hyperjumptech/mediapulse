import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const getHttpTriggersPageMock = vi.fn();
const getPipelinesWithStepsMock = vi.fn();

vi.mock("@/lib/require-dashboard-admin", () => ({
  withDashboardAdmin: <Value,>(load: Promise<Value>) => load,
}));

vi.mock("@/lib/http-triggers", () => ({
  getHttpTriggersPage: (...args: unknown[]) => getHttpTriggersPageMock(...args),
}));

vi.mock("@/lib/pipelines", () => ({
  getPipelinesWithSteps: () => getPipelinesWithStepsMock(),
}));

vi.mock("./http-triggers-with-modal", () => ({
  HttpTriggersWithModal: ({
    httpTriggers,
    pipelines,
    currentPage,
    total,
    searchQuery,
  }: {
    httpTriggers: Array<{ id: string }>;
    pipelines: Array<{ id: string }>;
    currentPage: number;
    total: number;
    searchQuery?: string;
  }) => (
    <div
      data-testid="http-triggers-with-modal"
      data-triggers-count={httpTriggers.length}
      data-pipelines-count={pipelines.length}
      data-page={currentPage}
      data-total={total}
      data-search={searchQuery ?? ""}
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
    getPipelinesWithStepsMock.mockReset();
  });

  it("renders HTTP triggers and pipelines from the loaders", async () => {
    // Setup
    getHttpTriggersPageMock.mockResolvedValue({
      httpTriggers: [{ id: "trigger-1" }],
      total: 16,
      page: 2,
      pageSize: 15,
    });
    getPipelinesWithStepsMock.mockResolvedValue([
      { id: "pipeline-1" },
      { id: "pipeline-2" },
    ]);

    // Act
    render(await HttpTriggersSection({ ...baseQuery, page: 2 }));

    // Assert
    const table = screen.getByTestId("http-triggers-with-modal");

    expect(table).toHaveAttribute("data-triggers-count", "1");
    expect(table).toHaveAttribute("data-pipelines-count", "2");
    expect(table).toHaveAttribute("data-page", "2");
    expect(table).toHaveAttribute("data-total", "16");
  });

  it("forwards search and sort to getHttpTriggersPage", async () => {
    // Setup
    getHttpTriggersPageMock.mockResolvedValue({
      httpTriggers: [],
      total: 0,
      page: 1,
      pageSize: 15,
    });
    getPipelinesWithStepsMock.mockResolvedValue([]);

    // Act
    render(
      await HttpTriggersSection({
        ...baseQuery,
        search: "webhook",
        sortBy: "method",
        sortDir: "desc",
      }),
    );

    // Assert
    expect(getHttpTriggersPageMock).toHaveBeenCalledWith(1, 15, {
      search: "webhook",
      sortBy: "method",
      sortDir: "desc",
    });
    expect(screen.getByTestId("http-triggers-with-modal")).toHaveAttribute(
      "data-search",
      "webhook",
    );
  });
});
