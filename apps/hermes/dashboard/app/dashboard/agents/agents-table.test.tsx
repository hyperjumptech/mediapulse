import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AgentsTable } from "./agents-table";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

vi.mock("@workspace/ui/components/table", () => ({
  Table: ({ children }: React.PropsWithChildren) => (
    <table data-testid="table">{children}</table>
  ),
  TableHeader: ({ children }: React.PropsWithChildren) => (
    <thead>{children}</thead>
  ),
  TableBody: ({ children }: React.PropsWithChildren) => (
    <tbody>{children}</tbody>
  ),
  TableRow: ({ children }: React.PropsWithChildren) => <tr>{children}</tr>,
  TableHead: ({ children }: React.PropsWithChildren) => <th>{children}</th>,
  TableCell: ({
    children,
    colSpan,
  }: React.PropsWithChildren<{ colSpan?: number }>) => (
    <td colSpan={colSpan}>{children}</td>
  ),
}));

vi.mock("@workspace/ui/components/badge", () => ({
  Badge: ({
    children,
    variant,
  }: React.PropsWithChildren<{ variant?: string }>) => (
    <span data-testid="badge" data-variant={variant}>
      {children}
    </span>
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

const createMockAgent = (
  overrides?: Partial<{
    id: string;
    agentId: string;
    agentVersion: string;
    description: string | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    domainIntegration: { integrationId: string };
  }>,
) => ({
  id: "agent-1",
  domainIntegrationId: "di-1",
  agentId: "test-agent",
  agentVersion: "1.0",
  description: "Test description",
  isActive: true,
  endpoint: { url: "https://example.com" },
  inputSchema: null,
  configSchema: null,
  createdAt: new Date("2024-01-15"),
  updatedAt: new Date("2024-01-15"),
  ...overrides,
  domainIntegration: overrides?.domainIntegration ?? {
    integrationId: "mediapulse-local",
  },
});

describe("AgentsTable", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders table headers", () => {
    // Act
    render(
      <AgentsTable agents={[]} sortBy="agentId" sortDir="asc" pageSize={15} />,
    );

    // Assert
    expect(screen.getByText("Agent ID")).toBeInTheDocument();
    expect(screen.getByText("Version")).toBeInTheDocument();
    expect(screen.getByText("Domain integration id")).toBeInTheDocument();
    expect(screen.getByText("Description")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Created")).toBeInTheDocument();
    expect(screen.getByText("Updated")).toBeInTheDocument();
  });

  it("renders empty state when no agents", () => {
    // Act
    render(
      <AgentsTable agents={[]} sortBy="agentId" sortDir="asc" pageSize={15} />,
    );

    // Assert
    expect(screen.getByText("No agents yet.")).toBeInTheDocument();
  });

  it("renders agent rows when agents provided", () => {
    // Setup
    const agents = [createMockAgent()];

    // Act
    render(
      <AgentsTable
        agents={agents}
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
    // Created and Updated columns both show formatted dates; header "Updated" confirms the column is present
  });

  it("displays Yes badge for active agents", () => {
    // Setup
    const agents = [createMockAgent({ isActive: true })];

    // Act
    render(
      <AgentsTable
        agents={agents}
        sortBy="agentId"
        sortDir="asc"
        pageSize={15}
      />,
    );

    // Assert
    expect(screen.getByText("Yes")).toBeInTheDocument();
    expect(screen.getByTestId("badge")).toHaveAttribute(
      "data-variant",
      "default",
    );
  });

  it("displays No badge for inactive agents", () => {
    // Setup
    const agents = [createMockAgent({ isActive: false })];

    // Act
    render(
      <AgentsTable
        agents={agents}
        sortBy="agentId"
        sortDir="asc"
        pageSize={15}
      />,
    );

    // Assert
    expect(screen.getByText("No")).toBeInTheDocument();
    expect(screen.getByTestId("badge")).toHaveAttribute(
      "data-variant",
      "secondary",
    );
  });

  it("displays dash for null description", () => {
    // Setup
    const agents = [createMockAgent({ description: null })];

    // Act
    render(
      <AgentsTable
        agents={agents}
        sortBy="agentId"
        sortDir="asc"
        pageSize={15}
      />,
    );

    // Assert
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders row actions for each agent", () => {
    // Setup
    const agents = [
      createMockAgent({
        id: "agent-1",
        agentId: "agent-a",
        agentVersion: "1.0",
      }),
      createMockAgent({
        id: "agent-2",
        agentId: "agent-b",
        agentVersion: "2.0",
      }),
    ];

    // Act
    render(
      <AgentsTable
        agents={agents}
        sortBy="agentId"
        sortDir="asc"
        pageSize={15}
      />,
    );

    // Assert
    expect(screen.getByTestId("row-actions-agent-1")).toBeInTheDocument();
    expect(screen.getByTestId("row-actions-agent-2")).toBeInTheDocument();
  });

  it("calls onView callback when clicking agent ID with onView prop", () => {
    // Setup
    const onView = vi.fn();
    const agent = createMockAgent();
    const agents = [agent];

    // Act
    render(
      <AgentsTable
        agents={agents}
        sortBy="agentId"
        sortDir="asc"
        pageSize={15}
        onView={onView}
      />,
    );

    const agentIdButton = screen.getByRole("button", { name: "test-agent" });
    fireEvent.click(agentIdButton);

    // Assert
    expect(onView).toHaveBeenCalledWith(agent);
  });

  it("renders link when onView not provided", () => {
    // Setup
    const agents = [createMockAgent({ id: "agent-123" })];

    // Act
    render(
      <AgentsTable
        agents={agents}
        sortBy="agentId"
        sortDir="asc"
        pageSize={15}
      />,
    );

    // Assert
    const link = screen.getByRole("link", { name: "test-agent" });
    expect(link).toHaveAttribute("href", "/dashboard/agents/agent-123");
  });

  it("renders sortable column headers as links", () => {
    // Act
    render(
      <AgentsTable agents={[]} sortBy="agentId" sortDir="asc" pageSize={15} />,
    );

    // Assert
    const agentIdLink = screen.getByRole("link", { name: /Agent ID/i });
    expect(agentIdLink).toBeInTheDocument();
  });
});
