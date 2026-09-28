import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
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

vi.mock("./add-contract-modal", () => ({
  AddContractModal: ({ trigger }: { trigger: React.ReactNode }) => (
    <div data-testid="add-contract-modal">{trigger}</div>
  ),
}));

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

describe("AgentContractsTable", () => {
  it("renders an empty state with an add contract action when there are no contracts", () => {
    // Act
    render(
      <AgentContractsTable
        contracts={[]}
        sortBy="name"
        sortDir="asc"
        pageSize={15}
        onEdit={vi.fn()}
      />,
    );

    // Assert
    expect(screen.getByText("No agent contracts yet")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(
      within(screen.getByTestId("add-contract-modal")).getByRole("button", {
        name: "Add contract",
      }),
    ).toBeInTheDocument();
  });

  it("renders the contract row fields", () => {
    // Act
    render(
      <AgentContractsTable
        contracts={[createContract()]}
        sortBy="name"
        sortDir="asc"
        pageSize={15}
        onEdit={vi.fn()}
      />,
    );

    // Assert
    expect(screen.getByText("Newsletter brief")).toBeInTheDocument();
    expect(screen.getByText("1.2")).toBeInTheDocument();
    expect(
      screen.getByText("What a good newsletter looks like"),
    ).toBeInTheDocument();
    expect(screen.getByText("Kevin")).toBeInTheDocument();
    expect(screen.getByRole("time")).toBeInTheDocument();
    expect(screen.getByTestId("row-actions-contract-1")).toBeInTheDocument();
  });

  it("opens the editor when the contract name is clicked", () => {
    // Setup
    const onEdit = vi.fn();
    const contract = createContract();
    render(
      <AgentContractsTable
        contracts={[contract]}
        sortBy="name"
        sortDir="asc"
        pageSize={15}
        onEdit={onEdit}
      />,
    );

    // Act
    fireEvent.click(
      screen.getByRole("button", { name: "Edit contract Newsletter brief" }),
    );

    // Assert
    expect(onEdit).toHaveBeenCalledWith(contract);
  });

  it("builds sort links that toggle the active column", () => {
    // Act
    render(
      <AgentContractsTable
        contracts={[createContract()]}
        sortBy="createdAt"
        sortDir="asc"
        pageSize={10}
        onEdit={vi.fn()}
      />,
    );

    // Assert
    expect(screen.getByRole("link", { name: /Name/ })).toHaveAttribute(
      "href",
      "/dashboard/agent-contracts?page=1&size=10&sort=name&dir=asc",
    );
    expect(screen.getByRole("link", { name: /Created/ })).toHaveAttribute(
      "href",
      "/dashboard/agent-contracts?page=1&size=10&sort=createdAt&dir=desc",
    );
  });
});
