import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

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
  it("renders the header with an add config link", async () => {
    // Act
    render(await AgentConfigsPage({ searchParams: {} }));

    // Assert
    expect(
      screen.getByRole("heading", { name: "Agent configs" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Add config" })).toHaveAttribute(
      "href",
      "/dashboard/agent-configs/new",
    );
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
