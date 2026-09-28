import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    className,
  }: {
    children: React.ReactNode;
    href: string;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

vi.mock("./agent-row-actions", () => ({
  AgentRowActions: ({
    agent,
    agentLabel,
  }: {
    agent: { id: string };
    agentLabel: string;
  }) => (
    <button data-testid={`row-actions-${agent.id}`} data-label={agentLabel}>
      Actions
    </button>
  ),
}));

import { AgentsTable } from "./agents-table";

const createMockAgent = (
  overrides?: Partial<{
    id: string;
    agentId: string;
    agentVersion: string;
    description: string | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }>,
) => ({
  id: "agent-1",
  agentId: "test-agent",
  agentVersion: "1.0",
  description: "Test description",
  isActive: true,
  createdAt: new Date("2024-01-15"),
  updatedAt: new Date("2024-01-15"),
  domainIntegration: { integrationId: "mediapulse-local" },
  ...overrides,
});

describe("AgentsTable", () => {
  it("renders the column headers", () => {
    // Act
    render(
      <AgentsTable
        agents={[createMockAgent()]}
        sortBy="agentId"
        sortDir="asc"
        pageSize={15}
      />,
    );

    // Assert
    const headers = screen
      .getAllByRole("columnheader")
      .map((header) => header.textContent);

    expect(headers).toEqual([
      "Agent ID",
      "Version",
      "Integration",
      "Description",
      "Status",
      "Created",
      "Updated",
      "Actions",
    ]);
  });

  it("renders a registration hint when there are no agents", () => {
    // Act
    render(
      <AgentsTable agents={[]} sortBy="agentId" sortDir="asc" pageSize={15} />,
    );

    // Assert
    expect(screen.getByText("No agents registered")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Clear search" }),
    ).not.toBeInTheDocument();
  });

  it("offers to clear the search when nothing matches", () => {
    // Act
    render(
      <AgentsTable
        agents={[]}
        sortBy="created"
        sortDir="desc"
        pageSize={20}
        searchQuery="summarizer"
      />,
    );

    // Assert
    expect(
      screen.getByText("No agents match “summarizer”"),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Clear search" })).toHaveAttribute(
      "href",
      "/dashboard/agents?page=1&size=20&sort=created&dir=desc",
    );
  });

  it("renders the agent row fields", () => {
    // Act
    render(
      <AgentsTable
        agents={[createMockAgent()]}
        sortBy="agentId"
        sortDir="asc"
        pageSize={15}
      />,
    );

    // Assert
    expect(screen.getByText("test-agent")).toBeInTheDocument();
    expect(screen.getByText("1.0")).toBeInTheDocument();
    expect(screen.getByText("mediapulse-local")).toBeInTheDocument();
    expect(screen.getByText("Test description")).toBeInTheDocument();
    expect(screen.getAllByRole("time")).toHaveLength(2);
    expect(screen.getByTestId("row-actions-agent-1")).toHaveAttribute(
      "data-label",
      "test-agent@1.0",
    );
  });

  it("shows an active status badge for active agents", () => {
    // Act
    render(
      <AgentsTable
        agents={[createMockAgent({ isActive: true })]}
        sortBy="agentId"
        sortDir="asc"
        pageSize={15}
      />,
    );

    // Assert
    expect(screen.getByText("active")).toHaveAttribute(
      "data-variant",
      "success",
    );
  });

  it("shows an inactive status badge for inactive agents", () => {
    // Act
    render(
      <AgentsTable
        agents={[createMockAgent({ isActive: false })]}
        sortBy="agentId"
        sortDir="asc"
        pageSize={15}
      />,
    );

    // Assert
    expect(screen.getByText("inactive")).toHaveAttribute(
      "data-variant",
      "muted",
    );
  });

  it("displays a dash for a missing description", () => {
    // Act
    render(
      <AgentsTable
        agents={[createMockAgent({ description: null })]}
        sortBy="agentId"
        sortDir="asc"
        pageSize={15}
      />,
    );

    // Assert
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("calls onView when the agent ID is clicked", () => {
    // Setup
    const onView = vi.fn();
    const agent = createMockAgent();
    render(
      <AgentsTable
        agents={[agent]}
        sortBy="agentId"
        sortDir="asc"
        pageSize={15}
        onView={onView}
      />,
    );

    // Act
    fireEvent.click(screen.getByRole("button", { name: "test-agent" }));

    // Assert
    expect(onView).toHaveBeenCalledWith(agent);
  });

  it("links the agent ID to the detail page without onView", () => {
    // Act
    render(
      <AgentsTable
        agents={[createMockAgent({ id: "agent-123" })]}
        sortBy="agentId"
        sortDir="asc"
        pageSize={15}
      />,
    );

    // Assert
    expect(screen.getByRole("link", { name: "test-agent" })).toHaveAttribute(
      "href",
      "/dashboard/agents/agent-123",
    );
  });

  it("builds sort links that toggle the active column and keep the search", () => {
    // Act
    render(
      <AgentsTable
        agents={[createMockAgent()]}
        sortBy="agentId"
        sortDir="asc"
        pageSize={15}
        searchQuery="test"
      />,
    );

    // Assert
    expect(screen.getByRole("link", { name: /Agent ID/ })).toHaveAttribute(
      "href",
      "/dashboard/agents?page=1&size=15&q=test&sort=agentId&dir=desc",
    );
    expect(screen.getByRole("link", { name: /Updated/ })).toHaveAttribute(
      "href",
      "/dashboard/agents?page=1&size=15&q=test&sort=updated&dir=asc",
    );
  });
});
