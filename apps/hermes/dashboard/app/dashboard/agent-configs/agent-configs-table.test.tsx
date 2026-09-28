import React from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@workspace/ui/components/tooltip";

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

const urlState = {
  basePath: "/dashboard/agent-configs",
  page: 1,
  pageSize: 15,
  total: 1,
  sortBy: "name",
  sortDir: "asc" as const,
};

const renderTable = (
  configs: AgentConfigRow[],
  overrides: Partial<React.ComponentProps<typeof AgentConfigsTable>> = {},
) =>
  render(
    <TooltipProvider>
      <AgentConfigsTable configs={configs} urlState={urlState} {...overrides} />
    </TooltipProvider>,
  );

const table = () => screen.getByRole("table");

const openMenu = async (trigger: HTMLElement) => {
  await act(async () => {
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
  });
};

const headerLabels = () =>
  within(table())
    .getAllByRole("columnheader")
    .map((header) => header.textContent);

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

  it("shows the useful columns and keeps Created by in the column menu", () => {
    // Act
    renderTable([createConfig()]);

    // Assert
    expect(headerLabels()).toEqual([
      "Name",
      "Agent",
      "Description",
      "Status",
      "Created",
      "Actions",
    ]);
  });

  it("shows Created by when the saved column choices turn it on", () => {
    // Act
    renderTable([createConfig()], {
      initialColumnVisibility: { createdBy: true },
    });

    // Assert
    expect(headerLabels()).toContain("Created by");
    expect(within(table()).getByText("Kevin")).toBeInTheDocument();
  });

  it("renders the config row fields", () => {
    // Act
    renderTable([createConfig()]);

    // Assert
    const desktop = within(table());

    expect(desktop.getByRole("link", { name: "Daily digest" })).toHaveAttribute(
      "href",
      "/dashboard/agent-configs/config-1/edit",
    );
    expect(desktop.getByText("summarizer@2.0.0")).toBeInTheDocument();
    expect(desktop.getByText("Digest settings")).toBeInTheDocument();
    expect(desktop.getByRole("time")).toBeInTheDocument();
    expect(desktop.getByTestId("row-actions-config-1")).toHaveAttribute(
      "data-label",
      "Daily digest",
    );
  });

  it("shows quiet text instead of a badge when the schema is unchanged", () => {
    // Act
    renderTable([createConfig({ schemaValid: true })]);

    // Assert
    expect(within(table()).getByText("Up to date")).not.toHaveAttribute(
      "data-variant",
    );
  });

  it("shows a warning badge when the agent schema changed", () => {
    // Act
    renderTable([createConfig({ schemaValid: false })]);

    // Assert
    expect(within(table()).getByText("Schema changed")).toHaveAttribute(
      "data-tone",
      "warning",
    );
  });

  it("marks the sorted column", () => {
    // Act
    renderTable([createConfig()]);

    // Assert
    const desktop = within(table());

    expect(desktop.getByRole("columnheader", { name: "Name" })).toHaveAttribute(
      "aria-sort",
      "ascending",
    );
    expect(
      desktop.getByRole("columnheader", { name: "Agent" }),
    ).not.toHaveAttribute("aria-sort");
  });

  it.each([
    ["Name", "name"],
    ["Agent", "agentId"],
    ["Created", "createdAt"],
  ])(
    "offers both sort directions from the %s header",
    async (label, sortKey) => {
      // Setup
      renderTable([createConfig()]);

      // Act
      await openMenu(within(table()).getByRole("button", { name: label }));

      // Assert
      expect(screen.getByRole("menuitem", { name: "Asc" })).toHaveAttribute(
        "href",
        `/dashboard/agent-configs?page=1&size=15&sort=${sortKey}&dir=asc`,
      );
      expect(screen.getByRole("menuitem", { name: "Desc" })).toHaveAttribute(
        "href",
        `/dashboard/agent-configs?page=1&size=15&sort=${sortKey}&dir=desc`,
      );
    },
  );

  it("paginates from the URL state when there is more than one page", () => {
    // Act
    renderTable([createConfig()], { urlState: { ...urlState, total: 40 } });

    // Assert
    expect(
      screen.getByRole("navigation", { name: "Agent configs list pagination" }),
    ).toBeInTheDocument();
  });
});
