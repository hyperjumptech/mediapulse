import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { VariableRow } from "@/lib/variables";

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

vi.mock("./variable-row-actions", () => ({
  VariableRowActions: ({
    variable,
    variableLabel,
  }: {
    variable: { id: string };
    variableLabel: string;
  }) => (
    <button
      data-testid={`row-actions-${variable.id}`}
      data-label={variableLabel}
    >
      Actions
    </button>
  ),
}));

import { VariablesTable } from "./variables-table";

const createVariable = (overrides?: Partial<VariableRow>): VariableRow => ({
  id: "variable-1",
  key: "API_URL",
  value: "https://api.example.com",
  note: "Primary endpoint",
  isSecret: false,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  createdBy: { id: "admin-1", name: "Kevin", email: "kevin@example.com" },
  ...overrides,
});

describe("VariablesTable", () => {
  it("renders an empty state with an add variable action when there are no variables", () => {
    // Act
    render(
      <VariablesTable
        variables={[]}
        sortBy="key"
        sortDir="asc"
        pageSize={15}
      />,
    );

    // Assert
    expect(screen.getByText("No variables yet")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(
      within(screen.getByTestId("variable-modal")).getByRole("button", {
        name: "Add variable",
      }),
    ).toBeInTheDocument();
  });

  it("offers to clear the search when nothing matches", () => {
    // Act
    render(
      <VariablesTable
        variables={[]}
        sortBy="created"
        sortDir="desc"
        pageSize={20}
        searchQuery="TOKEN"
      />,
    );

    // Assert
    expect(screen.getByText("No variables match “TOKEN”")).toBeInTheDocument();
    expect(screen.queryByTestId("variable-modal")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Clear search" })).toHaveAttribute(
      "href",
      "/dashboard/variables?page=1&size=20&sort=created&dir=desc",
    );
  });

  it("renders a plain variable with a copyable value", () => {
    // Act
    render(
      <VariablesTable
        variables={[createVariable()]}
        sortBy="key"
        sortDir="asc"
        pageSize={15}
      />,
    );

    // Assert
    expect(screen.getByText("API_URL")).toBeInTheDocument();
    expect(screen.getByText("https://api.example.com")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Copy value of API_URL" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Primary endpoint")).toBeInTheDocument();
    expect(screen.getByText("Kevin")).toBeInTheDocument();
    expect(screen.getByRole("time")).toBeInTheDocument();
    expect(screen.queryByText("Secret")).not.toBeInTheDocument();
  });

  it("keeps secret values masked and marks them with a secret badge", () => {
    // Act
    render(
      <VariablesTable
        variables={[createVariable({ isSecret: true, value: "••••••••" })]}
        sortBy="key"
        sortDir="asc"
        pageSize={15}
      />,
    );

    // Assert
    expect(screen.getByText("••••••••")).toBeInTheDocument();
    expect(screen.getByText("Secret")).toHaveAttribute("data-variant", "muted");
    expect(
      screen.queryByRole("button", { name: "Copy value of API_URL" }),
    ).not.toBeInTheDocument();
  });

  it("opens the editor when the key is clicked", () => {
    // Setup
    const onEdit = vi.fn();
    const variable = createVariable();
    render(
      <VariablesTable
        variables={[variable]}
        sortBy="key"
        sortDir="asc"
        pageSize={15}
        onEdit={onEdit}
      />,
    );

    // Act
    fireEvent.click(screen.getByRole("button", { name: "API_URL" }));

    // Assert
    expect(onEdit).toHaveBeenCalledWith(variable);
  });

  it("renders the key as plain text without onEdit", () => {
    // Act
    render(
      <VariablesTable
        variables={[createVariable()]}
        sortBy="key"
        sortDir="asc"
        pageSize={15}
      />,
    );

    // Assert
    expect(
      screen.queryByRole("button", { name: "API_URL" }),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("row-actions-variable-1")).toHaveAttribute(
      "data-label",
      "API_URL",
    );
  });

  it("builds sort links that toggle the active column and keep the search", () => {
    // Act
    render(
      <VariablesTable
        variables={[createVariable()]}
        sortBy="key"
        sortDir="asc"
        pageSize={15}
        searchQuery="API"
      />,
    );

    // Assert
    expect(screen.getByRole("link", { name: /Key/ })).toHaveAttribute(
      "href",
      "/dashboard/variables?page=1&size=15&q=API&sort=key&dir=desc",
    );
    expect(screen.getByRole("link", { name: /Created/ })).toHaveAttribute(
      "href",
      "/dashboard/variables?page=1&size=15&q=API&sort=created&dir=asc",
    );
  });
});
