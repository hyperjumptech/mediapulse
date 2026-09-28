import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./agent-configs-table", () => ({
  AgentConfigsTable: ({
    configs,
    sortBy,
    sortDir,
    pageSize,
  }: {
    configs: unknown[];
    sortBy: string;
    sortDir: string;
    pageSize: number;
  }) => (
    <div
      data-testid="agent-configs-table"
      data-count={configs.length}
      data-sort-by={sortBy}
      data-sort-dir={sortDir}
      data-page-size={pageSize}
    />
  ),
}));

vi.mock("@/components/list-pagination", () => ({
  ListPagination: ({
    basePath,
    page,
    total,
  }: {
    basePath: string;
    page: number;
    total: number;
  }) => (
    <nav
      data-testid="agent-configs-pagination"
      data-base-path={basePath}
      data-page={page}
      data-total={total}
    />
  ),
}));

import { AgentConfigsContent } from "./agent-configs-content";

describe("AgentConfigsContent", () => {
  it("renders the table and pagination without its own add action", () => {
    // Act
    render(
      <AgentConfigsContent
        configs={[]}
        agents={[]}
        total={42}
        page={2}
        pageSize={20}
        sortBy="agentId"
        sortDir="desc"
        pickerLoaders={{
          loadVariablesPage: vi.fn(),
          loadExpansionsPage: vi.fn(),
        }}
      />,
    );

    // Assert
    const table = screen.getByTestId("agent-configs-table");
    const pagination = screen.getByTestId("agent-configs-pagination");

    expect(table).toHaveAttribute("data-sort-by", "agentId");
    expect(table).toHaveAttribute("data-sort-dir", "desc");
    expect(table).toHaveAttribute("data-page-size", "20");
    expect(pagination).toHaveAttribute(
      "data-base-path",
      "/dashboard/agent-configs",
    );
    expect(pagination).toHaveAttribute("data-page", "2");
    expect(pagination).toHaveAttribute("data-total", "42");
    expect(
      screen.queryByRole("link", { name: "Add config" }),
    ).not.toBeInTheDocument();
  });
});
