import React from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./agent-contract-row-actions", () => ({
  AgentContractRowActions: ({ contract }: { contract: { id: string } }) => (
    <button data-testid={`row-actions-${contract.id}`}>Actions</button>
  ),
}));

import type { AgentContractRow } from "./agent-contract-row-actions";
import { AgentContractsTable } from "./agent-contracts-table";

const createContract = (
  overrides?: Partial<AgentContractRow>,
): AgentContractRow => ({
  id: "contract-1",
  name: "Newsletter brief",
  description: "What a good newsletter looks like",
  brief: "Write concise summaries.",
  version: "1.2",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  createdBy: { name: "Kevin", email: "kevin@example.com" },
  ...overrides,
});

const urlState = {
  basePath: "/dashboard/agent-contracts",
  page: 1,
  pageSize: 10,
  total: 1,
  sortBy: "createdAt",
  sortDir: "asc" as const,
};

const renderTable = (
  contracts: AgentContractRow[],
  overrides: Partial<React.ComponentProps<typeof AgentContractsTable>> = {},
) =>
  render(
    <AgentContractsTable
      contracts={contracts}
      urlState={urlState}
      onEdit={vi.fn()}
      {...overrides}
    />,
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

describe("AgentContractsTable", () => {
  it("renders an empty state with an add contract action when there are no contracts", () => {
    // Act
    renderTable([]);

    // Assert
    expect(screen.getByText("No agent contracts yet")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Add contract" })).toHaveAttribute(
      "href",
      "/dashboard/agent-contracts?create=1",
    );
  });

  it("shows the useful columns and keeps Created by in the column menu", () => {
    // Act
    renderTable([createContract()]);

    // Assert
    expect(headerLabels()).toEqual([
      "Name",
      "Version",
      "Description",
      "Created",
      "Actions",
    ]);
  });

  it("shows Created by when the saved column choices turn it on", () => {
    // Act
    renderTable([createContract()], {
      initialColumnVisibility: { createdBy: true },
    });

    // Assert
    expect(headerLabels()).toContain("Created by");
    expect(within(table()).getByText("Kevin")).toBeInTheDocument();
  });

  it("renders the contract row fields", () => {
    // Act
    renderTable([createContract()]);

    // Assert
    const desktop = within(table());

    expect(desktop.getByText("Newsletter brief")).toBeInTheDocument();
    expect(desktop.getByText("1.2")).toBeInTheDocument();
    expect(
      desktop.getByText("What a good newsletter looks like"),
    ).toBeInTheDocument();
    expect(desktop.getByRole("time")).toBeInTheDocument();
    expect(desktop.getByTestId("row-actions-contract-1")).toBeInTheDocument();
  });

  it("opens the editor when the contract name is clicked", () => {
    // Setup
    const onEdit = vi.fn();
    const contract = createContract();
    renderTable([contract], { onEdit });

    // Act
    fireEvent.click(
      within(table()).getByRole("button", {
        name: "Edit contract Newsletter brief",
      }),
    );

    // Assert
    expect(onEdit).toHaveBeenCalledWith(contract);
  });

  it("marks the sorted column and leaves Version unsortable", () => {
    // Act
    renderTable([createContract()]);

    // Assert
    const desktop = within(table());

    expect(
      desktop.getByRole("columnheader", { name: "Created" }),
    ).toHaveAttribute("aria-sort", "ascending");
    expect(
      desktop.getByRole("columnheader", { name: "Name" }),
    ).not.toHaveAttribute("aria-sort");
    expect(
      desktop.queryByRole("button", { name: "Version" }),
    ).not.toBeInTheDocument();
  });

  it.each([
    ["Name", "name"],
    ["Created", "createdAt"],
  ])(
    "offers both sort directions from the %s header",
    async (label, sortKey) => {
      // Setup
      renderTable([createContract()]);

      // Act
      await openMenu(within(table()).getByRole("button", { name: label }));

      // Assert
      expect(screen.getByRole("menuitem", { name: "Asc" })).toHaveAttribute(
        "href",
        `/dashboard/agent-contracts?page=1&size=10&sort=${sortKey}&dir=asc`,
      );
      expect(screen.getByRole("menuitem", { name: "Desc" })).toHaveAttribute(
        "href",
        `/dashboard/agent-contracts?page=1&size=10&sort=${sortKey}&dir=desc`,
      );
    },
  );

  it("paginates from the URL state when there is more than one page", () => {
    // Act
    renderTable([createContract()], { urlState: { ...urlState, total: 40 } });

    // Assert
    expect(
      screen.getByRole("navigation", {
        name: "Agent contracts list pagination",
      }),
    ).toBeInTheDocument();
  });
});
