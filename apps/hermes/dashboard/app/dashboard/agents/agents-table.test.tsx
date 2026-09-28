import React from "react";
import { render, screen, within } from "@testing-library/react";
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

const urlState = {
  basePath: "/dashboard/agents",
  page: 1,
  pageSize: 15,
  total: 1,
  sortBy: "agentId",
  sortDir: "asc" as const,
};

const renderAgents = (
  agents = [createMockAgent()],
  overrides: Partial<React.ComponentProps<typeof AgentsTable>> = {},
) =>
  render(
    <AgentsTable agents={agents as never} urlState={urlState} {...overrides} />,
  );

const table = () => screen.getByRole("table");

describe("AgentsTable", () => {
  it("shows the useful columns and keeps Created in the column menu", () => {
    renderAgents();

    const headers = within(table())
      .getAllByRole("columnheader")
      .map((header) => header.textContent);

    expect(headers).toEqual([
      "Agent ID",
      "Version",
      "Description",
      "Status",
      "Updated",
      "Actions",
    ]);
  });

  it("links the agent ID to its detail page", () => {
    renderAgents();

    expect(
      within(table()).getByRole("link", { name: "test-agent" }),
    ).toHaveAttribute("href", "/dashboard/agents/agent-1");
  });

  it("renders version, description and status", () => {
    renderAgents([createMockAgent({ isActive: false })]);

    const row = within(table()).getAllByRole("row")[1] as HTMLElement;

    expect(row).toHaveTextContent("1.0");
    expect(row).toHaveTextContent("Test description");
    expect(within(row).getByText("inactive")).toBeInTheDocument();
  });

  it("passes the agent key to the row actions", () => {
    renderAgents();

    expect(within(table()).getByTestId("row-actions-agent-1")).toHaveAttribute(
      "data-label",
      "test-agent@1.0",
    );
  });

  it("builds sort links from the URL state", () => {
    renderAgents();

    expect(
      within(table()).getByRole("link", { name: "Version" }),
    ).toHaveAttribute(
      "href",
      "/dashboard/agents?page=1&size=15&sort=agentVersion&dir=asc",
    );
  });

  it("explains that agents register themselves when the list is empty", () => {
    renderAgents([]);

    expect(screen.getByText("No agents registered")).toBeInTheDocument();
  });
});
