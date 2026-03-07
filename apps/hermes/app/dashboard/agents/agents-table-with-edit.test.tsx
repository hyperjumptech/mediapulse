import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AgentsTableWithEdit } from "./agents-table-with-edit";

vi.mock("./agents-table", () => ({
  AgentsTable: ({
    agents,
    onEdit,
    sortBy,
    sortDir,
    pageSize,
    searchQuery,
  }: {
    agents: Array<{ id: string; agentId: string }>;
    onEdit?: (agent: { id: string; agentId: string }) => void;
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
    >
      {agents.map((agent) => (
        <button
          key={agent.id}
          data-testid={`edit-${agent.id}`}
          onClick={() => onEdit?.(agent)}
        >
          Edit {agent.agentId}
        </button>
      ))}
    </div>
  ),
}));

vi.mock("./edit-agent-modal", () => ({
  EditAgentModal: ({
    agent,
    open,
    onOpenChange,
  }: {
    agent: { id: string; agentId: string } | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
  }) => (
    <div
      data-testid="edit-agent-modal"
      data-agent-id={agent?.id ?? "none"}
      data-open={open}
    >
      <button data-testid="close-modal" onClick={() => onOpenChange(false)}>
        Close
      </button>
    </div>
  ),
}));

const createMockAgent = (id: string, agentId: string) => ({
  id,
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

  it("renders edit agent modal", () => {
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
    expect(screen.getByTestId("edit-agent-modal")).toBeInTheDocument();
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

  it("modal is closed initially", () => {
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
    expect(screen.getByTestId("edit-agent-modal")).toHaveAttribute(
      "data-open",
      "false",
    );
  });

  it("opens modal when edit is clicked", () => {
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

    fireEvent.click(screen.getByTestId("edit-agent-1"));

    // Assert
    expect(screen.getByTestId("edit-agent-modal")).toHaveAttribute(
      "data-open",
      "true",
    );
  });

  it("passes selected agent to modal", () => {
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

    fireEvent.click(screen.getByTestId("edit-agent-1"));

    // Assert
    expect(screen.getByTestId("edit-agent-modal")).toHaveAttribute(
      "data-agent-id",
      "agent-1",
    );
  });

  it("closes modal and clears agent when onOpenChange(false)", () => {
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

    fireEvent.click(screen.getByTestId("edit-agent-1"));
    fireEvent.click(screen.getByTestId("close-modal"));

    // Assert
    expect(screen.getByTestId("edit-agent-modal")).toHaveAttribute(
      "data-open",
      "false",
    );
    expect(screen.getByTestId("edit-agent-modal")).toHaveAttribute(
      "data-agent-id",
      "none",
    );
  });
});
