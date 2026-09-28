import React from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { Inbox } from "lucide-react";
import { afterEach, describe, expect, it } from "vitest";

import { createDataTableColumnHelper } from "@/lib/data-table/features";
import type { ListUrlState } from "@/lib/data-table/list-url-state";

import { DataTable } from "./data-table";

type Fruit = { id: string; name: string; colour: string; stock: number };

const columnHelper = createDataTableColumnHelper<Fruit>();

const columns = columnHelper.columns([
  columnHelper.accessor("name", {
    id: "name",
    enableHiding: false,
    meta: { label: "Name", sortKey: "name", mobile: "title" },
    cell: ({ row }) => row.original.name,
  }),
  columnHelper.accessor("colour", {
    id: "colour",
    meta: { label: "Colour", mobile: "badge", hideBelow: "lg" },
    cell: ({ row }) => <span data-testid="colour">{row.original.colour}</span>,
  }),
  columnHelper.accessor("stock", {
    id: "stock",
    meta: { label: "Stock", sortKey: "stock" },
    cell: ({ row }) => row.original.stock,
  }),
  columnHelper.display({
    id: "actions",
    enableHiding: false,
    meta: { label: "Actions", mobile: "actions" },
    cell: ({ row }) => <button type="button">Edit {row.original.name}</button>,
  }),
]);

const fruits: Fruit[] = [
  { id: "f1", name: "Apple", colour: "Red", stock: 3 },
  { id: "f2", name: "Pear", colour: "Green", stock: 8 },
];

const urlState: ListUrlState = {
  basePath: "/dashboard/fruits",
  page: 1,
  pageSize: 15,
  total: 2,
  sortBy: "name",
  sortDir: "asc",
};

const renderTable = (
  overrides: Partial<React.ComponentProps<typeof DataTable<Fruit>>> = {},
) =>
  render(
    <DataTable
      tableId="fruits"
      columns={columns}
      rows={fruits}
      getRowId={(fruit) => fruit.id}
      urlState={urlState}
      paginationLabel="Fruit pagination"
      search={{ label: "Search fruit", placeholder: "Search…" }}
      emptyState={{ icon: Inbox, title: "No fruit yet" }}
      {...overrides}
    />,
  );

const desktopTable = () => screen.getByRole("table");

const mobileList = () =>
  document.querySelector<HTMLElement>('[data-slot="data-table-mobile-list"]');

afterEach(() => {
  document.cookie = "hermes_dt_fruits=; path=/; max-age=0";
});

describe("DataTable", () => {
  it("renders sortable headers that toggle the active column", () => {
    renderTable();

    const headers = within(desktopTable())
      .getAllByRole("columnheader")
      .map((header) => header.textContent);

    expect(headers).toEqual(["Name", "Colour", "Stock", "Actions"]);
    expect(
      within(desktopTable()).getByRole("link", { name: "Name" }),
    ).toHaveAttribute(
      "href",
      "/dashboard/fruits?page=1&size=15&sort=name&dir=desc",
    );
    expect(
      within(desktopTable()).getByRole("link", { name: "Stock" }),
    ).toHaveAttribute(
      "href",
      "/dashboard/fruits?page=1&size=15&sort=stock&dir=asc",
    );
  });

  it("hides columns below their breakpoint", () => {
    renderTable();

    const colourHeader = within(desktopTable()).getByRole("columnheader", {
      name: "Colour",
    });

    expect(colourHeader).toHaveClass("hidden", "lg:table-cell");
  });

  it("stacks rows as cards on small screens", () => {
    renderTable();

    const [appleCard] = within(mobileList() as HTMLElement).getAllByRole(
      "listitem",
    );

    expect(appleCard).toHaveTextContent("Apple");
    expect(
      within(appleCard as HTMLElement).getByTestId("colour"),
    ).toHaveTextContent("Red");
    expect(
      within(appleCard as HTMLElement).getByRole("term"),
    ).toHaveTextContent("Stock");
    expect(
      within(appleCard as HTMLElement).getByRole("button", {
        name: "Edit Apple",
      }),
    ).toBeInTheDocument();
  });

  it("lets people hide a column and remembers it in a cookie", async () => {
    renderTable();

    await act(async () => {
      fireEvent.pointerDown(screen.getByRole("button", { name: "Columns" }), {
        button: 0,
        ctrlKey: false,
      });
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("menuitemcheckbox", { name: "Stock" }));
    });

    expect(
      within(screen.getByRole("table", { hidden: true })).queryByRole(
        "columnheader",
        { name: "Stock", hidden: true },
      ),
    ).not.toBeInTheDocument();
    expect(decodeURIComponent(document.cookie)).toContain(
      'hermes_dt_fruits={"stock":false}',
    );
  });

  it("starts from the saved column visibility", () => {
    renderTable({ initialColumnVisibility: { colour: false } });

    expect(
      within(desktopTable()).queryByRole("columnheader", { name: "Colour" }),
    ).not.toBeInTheDocument();
  });

  it("keeps sort and page size in the search form", () => {
    renderTable();

    const form = screen.getByRole("search", { name: "Search fruit" });

    expect(form).toHaveAttribute("action", "/dashboard/fruits");
    expect(form.querySelector('input[name="sort"]')).toHaveValue("name");
    expect(form.querySelector('input[name="size"]')).toHaveValue("15");
  });

  it("keeps the column menu on desktop when there is no search or action", () => {
    renderTable({ urlState: undefined, search: undefined });

    const columnsButton = screen.getByRole("button", { name: "Columns" });

    expect(columnsButton.parentElement?.parentElement).toHaveClass(
      "hidden",
      "md:flex",
    );
  });

  it("drops the column menu when there are no rows to show", () => {
    renderTable({ rows: [], urlState: undefined, search: undefined });

    expect(
      screen.queryByRole("button", { name: "Columns" }),
    ).not.toBeInTheDocument();
  });

  it("shows the empty state when there are no rows", () => {
    renderTable({ rows: [] });

    expect(screen.getByText("No fruit yet")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("offers to clear a search that matched nothing", () => {
    renderTable({ rows: [], urlState: { ...urlState, search: "kiwi" } });

    expect(screen.getByText("Nothing matches “kiwi”")).toBeInTheDocument();
    const clearLinks = screen.getAllByRole("link", { name: "Clear search" });

    expect(clearLinks.map((link) => link.getAttribute("href"))).toEqual([
      "/dashboard/fruits?page=1&size=15&sort=name&dir=asc",
      "/dashboard/fruits?page=1&size=15&sort=name&dir=asc",
    ]);
  });

  it("renders pagination when a label is given and there is more than one page", () => {
    renderTable({ urlState: { ...urlState, total: 40 } });

    expect(
      screen.getByRole("navigation", { name: "Fruit pagination" }),
    ).toBeInTheDocument();
  });
});
