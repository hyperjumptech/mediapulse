import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./variables-section", () => ({
  VariablesSection: (props: Record<string, unknown>) => (
    <div data-testid="variables-section" data-query={JSON.stringify(props)} />
  ),
}));

vi.mock("./variable-modal", () => ({
  VariableModal: (props: Record<string, unknown>) => (
    <div
      data-testid="variable-modal"
      data-variable={String(props.variable)}
      data-prop-names={Object.keys(props).join(",")}
    />
  ),
}));

import VariablesPage from "./page";

const renderedQuery = () =>
  JSON.parse(
    screen.getByTestId("variables-section").getAttribute("data-query") ?? "{}",
  );

describe("VariablesPage", () => {
  it("mounts one URL-driven create variable modal without its own trigger", async () => {
    // Act
    render(await VariablesPage({ searchParams: {} }));

    // Assert
    const modal = screen.getByTestId("variable-modal");

    expect(modal).toHaveAttribute("data-variable", "null");
    expect(modal).toHaveAttribute("data-prop-names", "variable");
    expect(
      screen.queryByRole("button", { name: "Add variable" }),
    ).not.toBeInTheDocument();
    expect(renderedQuery()).toEqual({
      page: 1,
      pageSize: 15,
      sortBy: "key",
      sortDir: "asc",
    });
  });

  it("passes search, sort, and pagination to the section", async () => {
    // Act
    render(
      await VariablesPage({
        searchParams: Promise.resolve({
          q: " API_ ",
          sort: "created",
          dir: "desc",
          page: "3",
          size: "20",
        }),
      }),
    );

    // Assert
    expect(renderedQuery()).toEqual({
      page: 3,
      pageSize: 20,
      sortBy: "created",
      sortDir: "desc",
      search: "API_",
    });
  });
});
