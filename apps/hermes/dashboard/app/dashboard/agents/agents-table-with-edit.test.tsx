import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AgentsTableWithEdit } from "./agents-table-with-edit";

vi.mock("./agents-table", () => ({
  AgentsTable: ({
    agents,
    onView,
    sortBy,
    sortDir,
    pageSize,
    searchQuery,
  }: {
    agents: Array<{ id: string; agentId: string }>;
    onView?: (agent: { id: string; agentId: string }) => void;
    sortBy: string;
    sortDir: string;
    pageSize: number;
    searchQuery?: string;
  }) => (
    <div
      data-testid="agents-table"
      data-count={agents.length}
      data-sort-by={sortBy}
      data-sort-dir={sortDir}
      data-page-size={pageSize}
      data-search={searchQuery}
      data-has-on-view={onView != null ? "true" : "false"}
    >
      {agents.map((agent) => (
        <a key={agent.id} href={`/dashboard/agents/${agent.id}`}>
          View {agent.agentId}
        </a>
      ))}
    </div>
  ),
}));

const createMockAgent = (id: string, agentId: string) => ({
  id,
  domainIntegrationId: "di-1",
  agentId,
  agentVersion: "1.0",
  description: "Test description",
  endpoint: { url: "https://example.com" },
  inputSchema: null,
  configSchema: null,
  isActive: true,
  createdAt: new Date("2024-01-15"),
  updatedAt: new Date("2024-01-15"),
});

describe("AgentsTableWithEdit", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders agents table", () => {
    // Setup
    const agents = [createMockAgent("1", "agent-a")];

    // Act
    render(
      <AgentsTableWithEdit
        agents={agents}
        sortBy="agentId"
        sortDir="asc"
        pageSize={15}
      />,
    );

    // Assert
    expect(screen.getByTestId("agents-table")).toBeInTheDocument();
  });

  it("does not pass onView so table renders links to detail page", () => {
    // Setup
    const agents = [createMockAgent("agent-1", "agent-a")];

    // Act
    render(
      <AgentsTableWithEdit
        agents={agents}
        sortBy="agentId"
        sortDir="asc"
        pageSize={15}
      />,
    );

    // Assert
    expect(screen.getByTestId("agents-table")).toHaveAttribute(
      "data-has-on-view",
      "false",
    );
    const link = screen.getByRole("link", { name: /View agent-a/ });
    expect(link).toHaveAttribute("href", "/dashboard/agents/agent-1");
  });

  it("passes agents to table", () => {
    // Setup
    const agents = [
      createMockAgent("1", "agent-a"),
      createMockAgent("2", "agent-b"),
    ];

    // Act
    render(
      <AgentsTableWithEdit
        agents={agents}
        sortBy="agentId"
        sortDir="asc"
        pageSize={15}
      />,
    );

    // Assert
    expect(screen.getByTestId("agents-table")).toHaveAttribute(
      "data-count",
      "2",
    );
  });

  it("passes sort params to table", () => {
    // Setup
    const agents = [createMockAgent("1", "agent-a")];

    // Act
    render(
      <AgentsTableWithEdit
        agents={agents}
        sortBy="created"
        sortDir="desc"
        pageSize={20}
      />,
    );

    // Assert
    const table = screen.getByTestId("agents-table");
    expect(table).toHaveAttribute("data-sort-by", "created");
    expect(table).toHaveAttribute("data-sort-dir", "desc");
    expect(table).toHaveAttribute("data-page-size", "20");
  });

  it("passes search query to table", () => {
    // Setup
    const agents = [createMockAgent("1", "agent-a")];

    // Act
    render(
      <AgentsTableWithEdit
        agents={agents}
        sortBy="agentId"
        sortDir="asc"
        pageSize={15}
        searchQuery="test"
      />,
    );

    // Assert
    expect(screen.getByTestId("agents-table")).toHaveAttribute(
      "data-search",
      "test",
    );
  });
});
