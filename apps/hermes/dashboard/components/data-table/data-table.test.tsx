import React from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { Inbox } from "lucide-react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LIST_SEARCH_DEBOUNCE_MS } from "@/hooks/use-list-search";
import { createDataTableColumnHelper } from "@/lib/data-table/features";
import type { ListUrlState } from "@/lib/data-table/list-url-state";

import { DataTable } from "./data-table";

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

const openMenu = async (trigger: HTMLElement) => {
  await act(async () => {
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
  });
};

afterEach(() => {
  document.cookie = "hermes_dt_fruits=; path=/; max-age=0";
  vi.useRealTimers();
  router.replace.mockReset();
});

describe("DataTable", () => {
  it("marks the sorted column and offers both directions from its header", async () => {
    renderTable();

    const headers = within(desktopTable())
      .getAllByRole("columnheader")
      .map((header) => header.textContent);

    expect(headers).toEqual(["Name", "Colour", "Stock", "Actions"]);
    expect(
      within(desktopTable()).getByRole("columnheader", { name: "Name" }),
    ).toHaveAttribute("aria-sort", "ascending");

    await openMenu(
      within(desktopTable()).getByRole("button", { name: "Stock" }),
    );

    expect(screen.getByRole("menuitem", { name: "Asc" })).toHaveAttribute(
      "href",
      "/dashboard/fruits?page=1&size=15&sort=stock&dir=asc",
    );
    expect(screen.getByRole("menuitem", { name: "Desc" })).toHaveAttribute(
      "href",
      "/dashboard/fruits?page=1&size=15&sort=stock&dir=desc",
    );
  });

  it("hides a column from its header menu", async () => {
    renderTable();

    await openMenu(
      within(desktopTable()).getByRole("button", { name: "Stock" }),
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("menuitem", { name: "Hide" }));
    });

    expect(
      within(screen.getByRole("table", { hidden: true })).queryByRole(
        "columnheader",
        { name: "Stock", hidden: true },
      ),
    ).not.toBeInTheDocument();
  });

  it("sorts loaded rows in place when there is no URL state", async () => {
    renderTable({
      urlState: undefined,
      search: undefined,
      clientSorting: { initial: { id: "stock", desc: true } },
    });

    const names = () =>
      within(desktopTable())
        .getAllByRole("row")
        .slice(1)
        .map((row) => row.firstElementChild?.textContent);

    expect(names()).toEqual(["Pear", "Apple"]);
    expect(
      within(desktopTable()).getByRole("columnheader", { name: "Stock" }),
    ).toHaveAttribute("aria-sort", "descending");

    await openMenu(
      within(desktopTable()).getByRole("button", { name: "Stock" }),
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("menuitem", { name: "Asc" }));
    });

    expect(names()).toEqual(["Apple", "Pear"]);
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

    await openMenu(screen.getByRole("button", { name: "Customize columns" }));
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

  it("filters as people type, keeping sort and page size", async () => {
    vi.useFakeTimers();
    renderTable();

    fireEvent.change(screen.getByRole("searchbox", { name: "Search fruit" }), {
      target: { value: "pe" },
    });
    await act(async () => {
      vi.advanceTimersByTime(LIST_SEARCH_DEBOUNCE_MS);
    });

    expect(router.replace).toHaveBeenCalledWith(
      "/dashboard/fruits?page=1&size=15&q=pe&sort=name&dir=asc",
      { scroll: false },
    );
  });

  it("keeps the column menu when there is no search or action", () => {
    renderTable({ urlState: undefined, search: undefined });

    expect(
      screen.getByRole("button", { name: "Customize columns" }),
    ).toBeInTheDocument();
  });

  it("drops the column menu when there are no rows to show", () => {
    renderTable({ rows: [], urlState: undefined, search: undefined });

    expect(
      screen.queryByRole("button", { name: "Customize columns" }),
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
    expect(screen.getByRole("link", { name: "Clear search" })).toHaveAttribute(
      "href",
      "/dashboard/fruits?page=1&size=15&sort=name&dir=asc",
    );
  });

  it("renders pagination when a label is given and there is more than one page", () => {
    renderTable({ urlState: { ...urlState, total: 40 } });

    expect(
      screen.getByRole("navigation", { name: "Fruit pagination" }),
    ).toBeInTheDocument();
  });
});
