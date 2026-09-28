import React from "react";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./agent-contracts-section", () => ({
  AgentContractsSection: (props: Record<string, unknown>) => (
    <div
      data-testid="agent-contracts-section"
      data-query={JSON.stringify(props)}
    />
  ),
}));

vi.mock("./add-contract-modal", () => ({
  AddContractModal: ({ trigger }: { trigger: React.ReactNode }) => (
    <div data-testid="add-contract-modal">{trigger}</div>
  ),
}));

import AgentContractsPage from "./page";

const renderedQuery = () =>
  JSON.parse(
    screen.getByTestId("agent-contracts-section").getAttribute("data-query") ??
      "{}",
  );

describe("AgentContractsPage", () => {
  it("renders the header with an add contract action", async () => {
    // Act
    render(await AgentContractsPage({ searchParams: {} }));

    // Assert
    expect(
      within(screen.getByTestId("add-contract-modal")).getByRole("button", {
        name: "Add contract",
      }),
    ).toBeInTheDocument();
    expect(renderedQuery()).toEqual({
      page: 1,
      pageSize: 15,
      sortBy: "name",
      sortDir: "asc",
    });
  });

  it("passes sort and pagination to the section", async () => {
    // Act
    render(
      await AgentContractsPage({
        searchParams: Promise.resolve({
          sort: "createdAt",
          dir: "desc",
          page: "4",
          size: "10",
        }),
      }),
    );

    // Assert
    expect(renderedQuery()).toEqual({
      page: 4,
      pageSize: 10,
      sortBy: "createdAt",
      sortDir: "desc",
    });
  });
});
