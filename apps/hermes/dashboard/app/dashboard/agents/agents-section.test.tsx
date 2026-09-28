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

vi.mock("./agents-table-with-edit", () => ({
  AgentsTableWithEdit: ({
    agents,
  }: {
    agents: Array<{ id: string; agentId: string }>;
  }) => (
    <div data-testid="agents-table-with-edit" data-count={agents.length}>
      Table
    </div>
  ),
}));

vi.mock("@/components/list-pagination", () => ({
  ListPagination: ({ page, total }: { page: number; total: number }) => (
    <nav data-testid="agents-pagination" data-page={page} data-total={total}>
      Pagination
    </nav>
  ),
}));

vi.mock("./agents-search", () => ({
  AgentsSearch: ({ initialQuery }: { initialQuery?: string }) => (
    <div data-testid="agents-search" data-query={initialQuery ?? ""}>
      Search
    </div>
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

  it("renders agents table with data", async () => {
    // Setup
    getAgentsPageMock.mockResolvedValue({
      agents: [{ id: "1", agentId: "test-agent", agentVersion: "1.0" }],
      total: 1,
      page: 1,
      pageSize: 15,
    });

    // Act
    render(await AgentsSection(baseQuery));

    // Assert
    expect(screen.getByTestId("agents-table-with-edit")).toHaveAttribute(
      "data-count",
      "1",
    );
  });

  it("renders pagination", async () => {
    // Setup
    getAgentsPageMock.mockResolvedValue({
      agents: [],
      total: 30,
      page: 2,
      pageSize: 15,
    });

    // Act
    render(await AgentsSection({ ...baseQuery, page: 2 }));

    // Assert
    expect(screen.getByTestId("agents-pagination")).toHaveAttribute(
      "data-page",
      "2",
    );
    expect(screen.getByTestId("agents-pagination")).toHaveAttribute(
      "data-total",
      "30",
    );
  });

  it("renders search with initial query", async () => {
    // Setup
    getAgentsPageMock.mockResolvedValue({
      agents: [],
      total: 0,
      page: 1,
      pageSize: 15,
    });

    // Act
    render(await AgentsSection({ ...baseQuery, search: "summarizer" }));

    // Assert
    expect(screen.getByTestId("agents-search")).toHaveAttribute(
      "data-query",
      "summarizer",
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
