import React from "react";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./variables-section", () => ({
  VariablesSection: (props: Record<string, unknown>) => (
    <div data-testid="variables-section" data-query={JSON.stringify(props)} />
  ),
}));

vi.mock("./variable-modal", () => ({
  VariableModal: ({
    variable,
    trigger,
  }: {
    variable: null;
    trigger: React.ReactNode;
  }) => (
    <div data-testid="variable-modal" data-variable={String(variable)}>
      {trigger}
    </div>
  ),
}));

import VariablesPage from "./page";

const renderedQuery = () =>
  JSON.parse(
    screen.getByTestId("variables-section").getAttribute("data-query") ?? "{}",
  );

describe("VariablesPage", () => {
  it("renders the header with an add variable action", async () => {
    // Act
    render(await VariablesPage({ searchParams: {} }));

    // Assert
    const modal = screen.getByTestId("variable-modal");

    expect(
      screen.getByRole("heading", { name: "Variables" }),
    ).toBeInTheDocument();
    expect(modal).toHaveAttribute("data-variable", "null");
    expect(
      within(modal).getByRole("button", { name: "Add variable" }),
    ).toBeInTheDocument();
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
