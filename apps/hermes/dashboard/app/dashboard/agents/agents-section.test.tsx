import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const getAgentsPageMock = vi.fn();

vi.mock("@/lib/require-dashboard-admin", () => ({
  withDashboardAdmin: <Value,>(load: Promise<Value>) => load,
}));

vi.mock("@/lib/agents", () => ({
  getAgentsPage: (...args: unknown[]) => getAgentsPageMock(...args),
}));

vi.mock("@/lib/data-table/read-column-visibility", () => ({
  readColumnVisibility: async () => ({ description: false }),
}));

vi.mock("./agents-table", () => ({
  AgentsTable: ({
    agents,
    urlState,
    initialColumnVisibility,
  }: {
    agents: Array<{ id: string }>;
    urlState: { total: number; search?: string };
    initialColumnVisibility: Record<string, boolean>;
  }) => (
    <div
      data-testid="agents-table"
      data-count={agents.length}
      data-total={urlState.total}
      data-search={urlState.search ?? ""}
      data-visibility={JSON.stringify(initialColumnVisibility)}
    />
  ),
}));

import { AgentsSection } from "./agents-section";

const baseQuery = {
  page: 1,
  pageSize: 15,
  search: undefined,
  sortBy: "agentId" as const,
  sortDir: "asc" as const,
};

describe("AgentsSection", () => {
  afterEach(() => {
    getAgentsPageMock.mockReset();
  });

  it("hands the table its rows, URL state and saved column choices", async () => {
    // Setup
    getAgentsPageMock.mockResolvedValue({
      agents: [{ id: "1", agentId: "test-agent", agentVersion: "1.0" }],
      total: 30,
      page: 2,
      pageSize: 15,
    });

    // Act
    render(await AgentsSection({ ...baseQuery, page: 2, search: "test" }));

    // Assert
    const table = screen.getByTestId("agents-table");

    expect(table).toHaveAttribute("data-count", "1");
    expect(table).toHaveAttribute("data-total", "30");
    expect(table).toHaveAttribute("data-search", "test");
    expect(table).toHaveAttribute(
      "data-visibility",
      JSON.stringify({ created: false, description: false }),
    );
  });

  it("forwards search and sort to getAgentsPage", async () => {
    // Setup
    getAgentsPageMock.mockResolvedValue({
      agents: [],
      total: 0,
      page: 1,
      pageSize: 15,
    });

    // Act
    render(
      await AgentsSection({
        ...baseQuery,
        search: "test",
        sortBy: "created",
        sortDir: "desc",
      }),
    );

    // Assert
    expect(getAgentsPageMock).toHaveBeenCalledWith(1, 15, {
      search: "test",
      sortBy: "created",
      sortDir: "desc",
    });
  });
});
