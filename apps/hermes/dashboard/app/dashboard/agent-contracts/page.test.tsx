import React from "react";
import { render, screen } from "@testing-library/react";
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
  AddContractModal: (props: Record<string, unknown>) => (
    <div
      data-testid="add-contract-modal"
      data-prop-names={Object.keys(props).join(",")}
    />
  ),
}));

import AgentContractsPage from "./page";

const renderedQuery = () =>
  JSON.parse(
    screen.getByTestId("agent-contracts-section").getAttribute("data-query") ??
      "{}",
  );

describe("AgentContractsPage", () => {
  it("mounts one URL-driven add contract modal without its own trigger", async () => {
    // Act
    render(await AgentContractsPage({ searchParams: {} }));

    // Assert
    expect(screen.getByTestId("add-contract-modal")).toHaveAttribute(
      "data-prop-names",
      "",
    );
    expect(
      screen.queryByRole("button", { name: "Add contract" }),
    ).not.toBeInTheDocument();
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
