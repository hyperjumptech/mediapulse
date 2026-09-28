import React from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LIST_SEARCH_DEBOUNCE_MS } from "@/hooks/use-list-search";
import type { VariableRow } from "@/lib/variables";

const { router } = vi.hoisted(() => ({
  router: {
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  },
}));

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => router,
}));

vi.mock("./variable-modal", () => ({
  VariableModal: ({
    variable,
    open,
    onOpenChange,
  }: {
    variable: { key: string } | null;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
  }) => (
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

const openMenu = async (trigger: HTMLElement) => {
  await act(async () => {
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
  });
};

const editModal = () => screen.getByTestId("edit-variable-modal");

describe("VariablesTable", () => {
  afterEach(() => {
    vi.useRealTimers();
    router.replace.mockReset();
  });

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
    expect(screen.getByRole("link", { name: "Add variable" })).toHaveAttribute(
      "href",
      "/dashboard/variables?create=1",
    );
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
      screen.queryByRole("link", { name: "Add variable" }),
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
      "outline",
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

  it("marks the sorted column", () => {
    renderVariables();

    expect(
      within(table()).getByRole("columnheader", { name: "Key" }),
    ).toHaveAttribute("aria-sort", "ascending");
    expect(
      within(table()).getByRole("columnheader", { name: "Created" }),
    ).not.toHaveAttribute("aria-sort");
  });

  it.each([
    ["Key", "key"],
    ["Created", "created"],
  ])(
    "offers both sort directions from the %s header and keeps the search",
    async (label, sortKey) => {
      renderVariables([createVariable()], {
        urlState: { ...urlState, search: "API" },
      });

      await openMenu(within(table()).getByRole("button", { name: label }));

      expect(screen.getByRole("menuitem", { name: "Asc" })).toHaveAttribute(
        "href",
        `/dashboard/variables?page=1&size=15&q=API&sort=${sortKey}&dir=asc`,
      );
      expect(screen.getByRole("menuitem", { name: "Desc" })).toHaveAttribute(
        "href",
        `/dashboard/variables?page=1&size=15&q=API&sort=${sortKey}&dir=desc`,
      );
    },
  );

  it("searches variables by key as people type", async () => {
    vi.useFakeTimers();
    renderVariables();

    const form = screen.getByRole("search", {
      name: "Search variables by key",
    });
    const searchbox = within(form).getByRole("searchbox", {
      name: "Search variables by key",
    });

    expect(searchbox).toHaveAttribute("placeholder", "Filter variables…");

    fireEvent.change(searchbox, { target: { value: "API" } });
    await act(async () => {
      vi.advanceTimersByTime(LIST_SEARCH_DEBOUNCE_MS);
    });

    expect(router.replace).toHaveBeenCalledWith(
      "/dashboard/variables?page=1&size=15&q=API&sort=key&dir=asc",
      { scroll: false },
    );
  });
});
