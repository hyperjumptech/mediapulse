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
    open,
    onOpenChange,
  }: {
    variable: { key: string } | null;
    trigger?: React.ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
  }) =>
    trigger ? (
      <div data-testid="create-variable-modal">{trigger}</div>
    ) : (
      <div
        data-testid="edit-variable-modal"
        data-open={String(open)}
        data-variable-key={variable?.key ?? ""}
      >
        <button type="button" onClick={() => onOpenChange?.(false)}>
          Close editor
        </button>
      </div>
    ),
}));

vi.mock("./variable-row-actions", () => ({
  VariableRowActions: ({
    variable,
    variableLabel,
    onEdit,
  }: {
    variable: { id: string };
    variableLabel: string;
    onEdit?: (variable: { id: string }) => void;
  }) => (
    <button
      type="button"
      data-testid={`row-actions-${variable.id}`}
      data-label={variableLabel}
      onClick={() => onEdit?.(variable)}
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

const urlState = {
  basePath: "/dashboard/variables",
  page: 1,
  pageSize: 15,
  total: 1,
  sortBy: "key",
  sortDir: "asc" as const,
};

const renderVariables = (
  variables = [createVariable()],
  overrides: Partial<React.ComponentProps<typeof VariablesTable>> = {},
) =>
  render(
    <VariablesTable variables={variables} urlState={urlState} {...overrides} />,
  );

const table = () => screen.getByRole("table");

const editModal = () => screen.getByTestId("edit-variable-modal");

describe("VariablesTable", () => {
  it("shows the useful columns and keeps Created by in the column menu", () => {
    renderVariables();

    const headers = within(table())
      .getAllByRole("columnheader")
      .map((header) => header.textContent);

    expect(headers).toEqual(["Key", "Value", "Note", "Created", "Actions"]);
    expect(within(table()).queryByText("Kevin")).not.toBeInTheDocument();
  });

  it("shows Created by when the saved column choices turn it on", () => {
    renderVariables([createVariable()], { initialColumnVisibility: {} });

    const headers = within(table())
      .getAllByRole("columnheader")
      .map((header) => header.textContent);

    expect(headers).toContain("Created by");
    expect(within(table()).getByText("Kevin")).toBeInTheDocument();
  });

  it("renders an empty state with an add variable action when there are no variables", () => {
    renderVariables([]);

    expect(screen.getByText("No variables yet")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(
      within(screen.getByTestId("create-variable-modal")).getByRole("button", {
        name: "Add variable",
      }),
    ).toBeInTheDocument();
  });

  it("offers to clear the search when nothing matches", () => {
    renderVariables([], {
      urlState: {
        ...urlState,
        pageSize: 20,
        sortBy: "created",
        sortDir: "desc",
        search: "TOKEN",
      },
    });

    const clearLinks = screen.getAllByRole("link", { name: "Clear search" });

    expect(screen.getByText("Nothing matches “TOKEN”")).toBeInTheDocument();
    expect(
      screen.queryByTestId("create-variable-modal"),
    ).not.toBeInTheDocument();
    expect(clearLinks.map((link) => link.getAttribute("href"))).toContain(
      "/dashboard/variables?page=1&size=20&sort=created&dir=desc",
    );
  });

  it("renders a plain variable with a copyable value", () => {
    renderVariables();

    const row = within(table()).getAllByRole("row")[1] as HTMLElement;

    expect(row).toHaveTextContent("API_URL");
    expect(row).toHaveTextContent("https://api.example.com");
    expect(
      within(row).getByRole("button", { name: "Copy value of API_URL" }),
    ).toBeInTheDocument();
    expect(row).toHaveTextContent("Primary endpoint");
    expect(within(row).getByRole("time")).toBeInTheDocument();
    expect(within(row).queryByText("Secret")).not.toBeInTheDocument();
  });

  it("keeps secret values masked and marks them with a secret badge", () => {
    renderVariables([createVariable({ isSecret: true, value: "••••••••" })]);

    const row = within(table()).getAllByRole("row")[1] as HTMLElement;

    expect(within(row).getByText("••••••••")).toBeInTheDocument();
    expect(within(row).getByText("Secret")).toHaveAttribute(
      "data-variant",
      "muted",
    );
    expect(
      within(row).queryByRole("button", { name: "Copy value of API_URL" }),
    ).not.toBeInTheDocument();
  });

  it("opens the editor when the key is clicked and closes it again", () => {
    renderVariables();

    fireEvent.click(within(table()).getByRole("button", { name: "API_URL" }));

    expect(editModal()).toHaveAttribute("data-open", "true");
    expect(editModal()).toHaveAttribute("data-variable-key", "API_URL");

    fireEvent.click(screen.getByRole("button", { name: "Close editor" }));

    expect(editModal()).toHaveAttribute("data-open", "false");
    expect(editModal()).toHaveAttribute("data-variable-key", "");
  });

  it("opens the editor from the row actions", () => {
    renderVariables();

    const rowActions = within(table()).getByTestId("row-actions-variable-1");

    expect(rowActions).toHaveAttribute("data-label", "API_URL");

    fireEvent.click(rowActions);

    expect(editModal()).toHaveAttribute("data-open", "true");
    expect(editModal()).toHaveAttribute("data-variable-key", "API_URL");
  });

  it("builds sort links that toggle the active column and keep the search", () => {
    renderVariables([createVariable()], {
      urlState: { ...urlState, search: "API" },
    });

    expect(within(table()).getByRole("link", { name: "Key" })).toHaveAttribute(
      "href",
      "/dashboard/variables?page=1&size=15&q=API&sort=key&dir=desc",
    );
    expect(
      within(table()).getByRole("link", { name: "Created" }),
    ).toHaveAttribute(
      "href",
      "/dashboard/variables?page=1&size=15&q=API&sort=created&dir=asc",
    );
  });

  it("searches variables by key", () => {
    renderVariables();

    const form = screen.getByRole("search", {
      name: "Search variables by key",
    });

    expect(form).toHaveAttribute("action", "/dashboard/variables");
    expect(form.querySelector('input[name="q"]')).toHaveAttribute(
      "placeholder",
      "Search by key…",
    );
  });
});
