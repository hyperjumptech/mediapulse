import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@workspace/ui/components/tooltip";

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

vi.mock("./agent-config-row-actions", () => ({
  AgentConfigRowActions: ({
    config,
    configLabel,
  }: {
    config: { id: string };
    configLabel: string;
  }) => (
    <button data-testid={`row-actions-${config.id}`} data-label={configLabel}>
      Actions
    </button>
  ),
}));

import type { AgentConfigRow } from "./agent-config-row-actions";
import { AgentConfigsTable } from "./agent-configs-table";

const createConfig = (overrides?: Partial<AgentConfigRow>): AgentConfigRow => ({
  id: "config-1",
  name: "Daily digest",
  description: "Digest settings",
  agentId: "summarizer",
  agentVersion: "2.0.0",
  config: {},
  configSchemaFingerprint: "fingerprint",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  createdBy: { name: "Kevin", email: "kevin@example.com" },
  schemaValid: true,
  ...overrides,
});

const renderTable = (configs: AgentConfigRow[]) =>
  render(
    <TooltipProvider>
      <AgentConfigsTable
        configs={configs}
        sortBy="name"
        sortDir="asc"
        pageSize={15}
      />
    </TooltipProvider>,
  );

describe("AgentConfigsTable", () => {
  it("renders an empty state with an add config link when there are no configs", () => {
    // Act
    renderTable([]);

    // Assert
    expect(screen.getByText("No agent configs yet")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Add config" })).toHaveAttribute(
      "href",
      "/dashboard/agent-configs/new",
    );
  });

  it("renders the config row fields", () => {
    // Act
    renderTable([createConfig()]);

    // Assert
    expect(screen.getByRole("link", { name: "Daily digest" })).toHaveAttribute(
      "href",
      "/dashboard/agent-configs/config-1/edit",
    );
    expect(screen.getByText("summarizer@2.0.0")).toBeInTheDocument();
    expect(screen.getByText("Digest settings")).toBeInTheDocument();
    expect(screen.getByText("Kevin")).toBeInTheDocument();
    expect(screen.getByRole("time")).toBeInTheDocument();
    expect(screen.getByTestId("row-actions-config-1")).toHaveAttribute(
      "data-label",
      "Daily digest",
    );
  });

  it("shows quiet text instead of a badge when the schema is unchanged", () => {
    // Act
    renderTable([createConfig({ schemaValid: true })]);

    // Assert
    expect(screen.getByText("Up to date")).not.toHaveAttribute("data-variant");
  });

  it("shows a warning badge when the agent schema changed", () => {
    // Act
    renderTable([createConfig({ schemaValid: false })]);

    // Assert
    expect(screen.getByText("Schema changed")).toHaveAttribute(
      "data-variant",
      "warning",
    );
  });

  it("builds sort links that toggle the active column", () => {
    // Act
    renderTable([createConfig()]);

    // Assert
    expect(screen.getByRole("link", { name: /Name/ })).toHaveAttribute(
      "href",
      "/dashboard/agent-configs?page=1&size=15&sort=name&dir=desc",
    );
    expect(screen.getByRole("link", { name: /Agent/ })).toHaveAttribute(
      "href",
      "/dashboard/agent-configs?page=1&size=15&sort=agentId&dir=asc",
    );
    expect(screen.getByRole("link", { name: /Created/ })).toHaveAttribute(
      "href",
      "/dashboard/agent-configs?page=1&size=15&sort=createdAt&dir=asc",
    );
  });
});
