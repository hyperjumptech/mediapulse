import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./http-triggers-section", () => ({
  HttpTriggersSection: (props: Record<string, unknown>) => (
    <div
      data-testid="http-triggers-section"
      data-query={JSON.stringify(props)}
    />
  ),
}));

import HttpTriggersPage from "./page";

const renderedQuery = () =>
  JSON.parse(
    screen.getByTestId("http-triggers-section").getAttribute("data-query") ??
      "{}",
  );

describe("HttpTriggersPage", () => {
  it("renders the section and leaves the new trigger action to the site header", async () => {
    // Act
    render(await HttpTriggersPage({ searchParams: {} }));

    // Assert
    expect(
      screen.queryByRole("button", { name: "New HTTP trigger" }),
    ).not.toBeInTheDocument();
    expect(renderedQuery()).toEqual({
      page: 1,
      pageSize: 15,
      sortBy: "name",
      sortDir: "asc",
    });
  });

  it("passes search, sort, and pagination to the section", async () => {
    // Act
    render(
      await HttpTriggersPage({
        searchParams: Promise.resolve({
          q: " webhook ",
          sort: "method",
          dir: "desc",
          page: "2",
          size: "30",
        }),
      }),
    );

    // Assert
    expect(renderedQuery()).toEqual({
      page: 2,
      pageSize: 30,
      sortBy: "method",
      sortDir: "desc",
      search: "webhook",
    });
  });
});
