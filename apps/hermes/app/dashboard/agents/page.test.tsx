import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const cookiesMock = vi.fn();
const getAgentsPageMock = vi.fn();

vi.mock("next/headers", () => ({
  cookies: () => cookiesMock(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
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

vi.mock("@/components/with-auth-protection", () => ({
  withAuthProtection: <P extends Record<string, unknown>>(
    Component: (props: P) => React.ReactNode,
  ) => Component,
}));

import AgentsPage from "./page";

describe("AgentsPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    cookiesMock.mockReset();
    getAgentsPageMock.mockReset();
  });

  it("renders agents table with data when authenticated", async () => {
    // Setup
    getAgentsPageMock.mockResolvedValue({
      agents: [{ id: "1", agentId: "test-agent", agentVersion: "1.0" }],
      total: 1,
      page: 1,
      pageSize: 15,
    });

    // Act
    const component = await AgentsPage({ searchParams: {} });
    render(component);

    // Assert
    expect(screen.getByTestId("agents-table-with-edit")).toBeInTheDocument();
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
    const component = await AgentsPage({ searchParams: { page: "2" } });
    render(component);

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
    const component = await AgentsPage({ searchParams: { q: "summarizer" } });
    render(component);

    // Assert
    expect(screen.getByTestId("agents-search")).toHaveAttribute(
      "data-query",
      "summarizer",
    );
  });

  it("passes search query to getAgentsPage", async () => {
    // Setup
    getAgentsPageMock.mockResolvedValue({
      agents: [],
      total: 0,
      page: 1,
      pageSize: 15,
    });

    // Act
    await AgentsPage({ searchParams: { q: "test" } });

    // Assert
    expect(getAgentsPageMock).toHaveBeenCalledWith(
      1,
      15,
      expect.objectContaining({ search: "test" }),
    );
  });

  it("parses sort parameters correctly", async () => {
    // Setup
    getAgentsPageMock.mockResolvedValue({
      agents: [],
      total: 0,
      page: 1,
      pageSize: 15,
    });

    // Act
    await AgentsPage({ searchParams: { sort: "created", dir: "desc" } });

    // Assert
    expect(getAgentsPageMock).toHaveBeenCalledWith(
      1,
      15,
      expect.objectContaining({ sortBy: "created", sortDir: "desc" }),
    );
  });
});
