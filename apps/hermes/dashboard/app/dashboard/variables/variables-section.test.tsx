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

vi.mock("@/lib/data-table/read-column-visibility", () => ({
  readColumnVisibility: async () => ({ note: false }),
}));

vi.mock("./variables-table", () => ({
  VariablesTable: ({
    variables,
    urlState,
    initialColumnVisibility,
  }: {
    variables: Array<{ id: string }>;
    urlState: {
      basePath: string;
      page: number;
      total: number;
      search?: string;
      sortBy?: string;
      sortDir: string;
    };
    initialColumnVisibility: Record<string, boolean>;
  }) => (
    <div
      data-testid="variables-table"
      data-count={variables.length}
      data-url-state={JSON.stringify(urlState)}
      data-visibility={JSON.stringify(initialColumnVisibility)}
    />
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

const renderedTable = () => screen.getByTestId("variables-table");

const renderedUrlState = () =>
  JSON.parse(renderedTable().getAttribute("data-url-state") ?? "{}");

describe("VariablesSection", () => {
  afterEach(() => {
    getVariablesPageMock.mockReset();
  });

  it("hands the table its rows, URL state and saved column choices", async () => {
    getVariablesPageMock.mockResolvedValue({
      variables: [{ id: "1", key: "API_URL" }],
      total: 30,
      page: 2,
      pageSize: 15,
    });

    render(await VariablesSection({ ...baseQuery, page: 2, search: "api" }));

    expect(renderedTable()).toHaveAttribute("data-count", "1");
    expect(renderedUrlState()).toEqual({
      basePath: "/dashboard/variables",
      page: 2,
      pageSize: 15,
      total: 30,
      search: "api",
      sortBy: "key",
      sortDir: "asc",
    });
    expect(renderedTable()).toHaveAttribute(
      "data-visibility",
      JSON.stringify({ createdBy: false, note: false }),
    );
  });

  it("forwards search and sort to getVariablesPage", async () => {
    getVariablesPageMock.mockResolvedValue({
      variables: [],
      total: 0,
      page: 1,
      pageSize: 15,
    });

    render(
      await VariablesSection({
        ...baseQuery,
        search: "api",
        sortBy: "created",
        sortDir: "desc",
      }),
    );

    expect(getVariablesPageMock).toHaveBeenCalledWith(1, 15, {
      search: "api",
      sortBy: "created",
      sortDir: "desc",
    });
  });
});
