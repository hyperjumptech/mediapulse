import React from "react";
import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { AgentContractRow } from "./agent-contract-row-actions";

vi.mock("./agent-contracts-table", () => ({
  AgentContractsTable: ({
    contracts,
    onEdit,
  }: {
    contracts: AgentContractRow[];
    onEdit: (contract: AgentContractRow) => void;
  }) => (
    <div data-testid="agent-contracts-table" data-count={contracts.length}>
      {contracts.map((contract) => (
        <button
          key={contract.id}
          type="button"
          onClick={() => onEdit(contract)}
        >
          Edit {contract.name}
        </button>
      ))}
    </div>
  ),
}));

vi.mock("./edit-contract-modal", () => ({
  EditContractModal: ({
    contract,
    open,
    onOpenChange,
  }: {
    contract: AgentContractRow | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
  }) => (
    <div
      data-testid="edit-contract-modal"
      data-open={String(open)}
      data-contract={contract?.id ?? ""}
    >
      <button type="button" onClick={() => onOpenChange(false)}>
        Close editor
      </button>
    </div>
  ),
}));

vi.mock("@/components/list-pagination", () => ({
  ListPagination: ({
    basePath,
    total,
  }: {
    basePath: string;
    total: number;
  }) => (
    <nav
      data-testid="agent-contracts-pagination"
      data-base-path={basePath}
      data-total={total}
    />
  ),
}));

import { AgentContractsContent } from "./agent-contracts-content";

const contract: AgentContractRow = {
  id: "contract-1",
  name: "Newsletter brief",
  description: null,
  brief: "Write concise summaries.",
  version: "1.0",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  createdBy: null,
};

const renderContent = () =>
  render(
    <AgentContractsContent
      contracts={[contract]}
      total={12}
      page={1}
      pageSize={10}
      sortBy="name"
      sortDir="asc"
    />,
  );

describe("AgentContractsContent", () => {
  it("renders the table and pagination without its own add action", () => {
    // Act
    renderContent();

    // Assert
    expect(screen.getByTestId("agent-contracts-table")).toHaveAttribute(
      "data-count",
      "1",
    );
    expect(screen.getByTestId("agent-contracts-pagination")).toHaveAttribute(
      "data-base-path",
      "/dashboard/agent-contracts",
    );
    expect(
      screen.queryByRole("button", { name: "Add contract" }),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("edit-contract-modal")).toHaveAttribute(
      "data-open",
      "false",
    );
  });

  it("opens the editor for the selected contract", () => {
    // Setup
    renderContent();

    // Act
    act(() => {
      screen.getByRole("button", { name: "Edit Newsletter brief" }).click();
    });

    // Assert
    const modal = screen.getByTestId("edit-contract-modal");

    expect(modal).toHaveAttribute("data-open", "true");
    expect(modal).toHaveAttribute("data-contract", "contract-1");
  });

  it("clears the selected contract when the editor closes", () => {
    // Setup
    renderContent();
    act(() => {
      screen.getByRole("button", { name: "Edit Newsletter brief" }).click();
    });

    // Act
    act(() => {
      screen.getByRole("button", { name: "Close editor" }).click();
    });

    // Assert
    const modal = screen.getByTestId("edit-contract-modal");

    expect(modal).toHaveAttribute("data-open", "false");
    expect(modal).toHaveAttribute("data-contract", "");
  });
});
