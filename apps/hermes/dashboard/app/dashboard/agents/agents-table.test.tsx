import React from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

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

const openMenu = async (trigger: HTMLElement) => {
  await act(async () => {
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
  });
};

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

  it("marks the sorted column from the URL state", () => {
    renderAgents();

    expect(
      within(table()).getByRole("columnheader", { name: "Agent ID" }),
    ).toHaveAttribute("aria-sort", "ascending");
    expect(
      within(table()).getByRole("columnheader", { name: "Version" }),
    ).not.toHaveAttribute("aria-sort");
  });

  it("offers both sort directions from a column header", async () => {
    renderAgents();

    await openMenu(within(table()).getByRole("button", { name: "Version" }));

    expect(screen.getByRole("menuitem", { name: "Asc" })).toHaveAttribute(
      "href",
      "/dashboard/agents?page=1&size=15&sort=agentVersion&dir=asc",
    );
    expect(screen.getByRole("menuitem", { name: "Desc" })).toHaveAttribute(
      "href",
      "/dashboard/agents?page=1&size=15&sort=agentVersion&dir=desc",
    );
  });

  it("explains that agents register themselves when the list is empty", () => {
    renderAgents([]);

    expect(screen.getByText("No agents registered")).toBeInTheDocument();
  });
});
