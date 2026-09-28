import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./agents-section", () => ({
  AgentsSection: (props: Record<string, unknown>) => (
    <div data-testid="agents-section" data-query={JSON.stringify(props)} />
  ),
}));

import AgentsPage from "./page";

const renderedQuery = () =>
  JSON.parse(
    screen.getByTestId("agents-section").getAttribute("data-query") ?? "{}",
  );

describe("AgentsPage", () => {
  it("renders the page header and the agents section", async () => {
    // Act
    render(await AgentsPage({ searchParams: {} }));

    // Assert
    expect(renderedQuery()).toEqual({
      page: 1,
      pageSize: 15,
      sortBy: "agentId",
      sortDir: "asc",
    });
  });

  it("passes search, sort, and pagination to the section", async () => {
    // Act
    render(
      await AgentsPage({
        searchParams: Promise.resolve({
          q: " summarizer ",
          sort: "created",
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
      sortBy: "created",
      sortDir: "desc",
      search: "summarizer",
    });
  });

  it("falls back to defaults for unknown sort fields", async () => {
    // Act
    render(
      await AgentsPage({ searchParams: { sort: "bogus", dir: "sideways" } }),
    );

    // Assert
    expect(renderedQuery()).toMatchObject({
      sortBy: "agentId",
      sortDir: "asc",
    });
  });
});
