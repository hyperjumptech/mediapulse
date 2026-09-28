import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const getVariablesPageMock = vi.fn();

vi.mock("@/lib/require-dashboard-admin", () => ({
  withDashboardAdmin: <Value,>(load: Promise<Value>) => load,
}));

vi.mock("@/lib/variables", () => ({
  getVariablesPage: (...args: unknown[]) => getVariablesPageMock(...args),
}));

vi.mock("./variables-table-with-edit", () => ({
  VariablesTableWithEdit: ({
    variables,
  }: {
    variables: Array<{ id: string; key: string }>;
  }) => (
    <div data-testid="variables-table-with-edit" data-count={variables.length}>
      Table
    </div>
  ),
}));

vi.mock("@/components/list-pagination", () => ({
  ListPagination: ({ page, total }: { page: number; total: number }) => (
    <nav data-testid="variables-pagination" data-page={page} data-total={total}>
      Pagination
    </nav>
  ),
}));

vi.mock("./variables-search", () => ({
  VariablesSearch: ({ initialQuery }: { initialQuery?: string }) => (
    <div data-testid="variables-search" data-query={initialQuery ?? ""}>
      Search
    </div>
  ),
}));

vi.mock("./variable-modal", () => ({
  VariableModal: ({ trigger }: { trigger: React.ReactNode }) => (
    <div data-testid="variable-modal">{trigger}</div>
  ),
}));

import { VariablesSection } from "./variables-section";

const baseQuery = {
  page: 1,
  pageSize: 15,
  search: undefined,
  sortBy: "key" as const,
  sortDir: "asc" as const,
};

describe("VariablesSection", () => {
  afterEach(() => {
    getVariablesPageMock.mockReset();
  });

  it("renders the toolbar, table, and pagination from the loader", async () => {
    // Setup
    getVariablesPageMock.mockResolvedValue({
      variables: [{ id: "1", key: "API_URL" }],
      total: 30,
      page: 2,
      pageSize: 15,
    });

    // Act
    render(await VariablesSection({ ...baseQuery, page: 2 }));

    // Assert
    expect(screen.getByTestId("variables-table-with-edit")).toHaveAttribute(
      "data-count",
      "1",
    );
    expect(screen.getByTestId("variables-pagination")).toHaveAttribute(
      "data-page",
      "2",
    );
    expect(screen.getByTestId("variables-pagination")).toHaveAttribute(
      "data-total",
      "30",
    );
    expect(
      screen.getByRole("button", { name: "Add variable" }),
    ).toBeInTheDocument();
  });

  it("forwards search and sort to getVariablesPage", async () => {
    // Setup
    getVariablesPageMock.mockResolvedValue({
      variables: [],
      total: 0,
      page: 1,
      pageSize: 15,
    });

    // Act
    render(
      await VariablesSection({
        ...baseQuery,
        search: "api",
        sortBy: "created",
        sortDir: "desc",
      }),
    );

    // Assert
    expect(getVariablesPageMock).toHaveBeenCalledWith(1, 15, {
      search: "api",
      sortBy: "created",
      sortDir: "desc",
    });
    expect(screen.getByTestId("variables-search")).toHaveAttribute(
      "data-query",
      "api",
    );
  });
});
