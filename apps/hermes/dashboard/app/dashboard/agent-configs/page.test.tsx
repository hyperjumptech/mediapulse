import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./agent-configs-section", () => ({
  AgentConfigsSection: (props: Record<string, unknown>) => (
    <div
      data-testid="agent-configs-section"
      data-query={JSON.stringify(props)}
    />
  ),
}));

import AgentConfigsPage from "./page";

const renderedQuery = () =>
  JSON.parse(
    screen.getByTestId("agent-configs-section").getAttribute("data-query") ??
      "{}",
  );

describe("AgentConfigsPage", () => {
  it("leaves the add config link to the site header", async () => {
    // Act
    render(await AgentConfigsPage({ searchParams: {} }));

    // Assert
    expect(
      screen.queryByRole("link", { name: "Add config" }),
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
      await AgentConfigsPage({
        searchParams: Promise.resolve({
          sort: "agentId",
          dir: "desc",
          page: "2",
          size: "25",
        }),
      }),
    );

    // Assert
    expect(renderedQuery()).toEqual({
      page: 2,
      pageSize: 25,
      sortBy: "agentId",
      sortDir: "desc",
    });
  });
});
