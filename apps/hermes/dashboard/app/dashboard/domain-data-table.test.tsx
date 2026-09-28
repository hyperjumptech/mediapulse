import React from "react";
import { render, screen, within } from "@testing-library/react";
import { tableV1MetaResponseSchema } from "@hermes/domain-contract";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ListUrlState } from "@/lib/data-table/list-url-state";
import { DateTimeContext } from "@/lib/date-time/date-time-context";
import type { DomainTableColumn } from "@/lib/domain-table-columns";
import { parseDomainTableFormFieldsFromJsonSchema } from "@/lib/domain-table-form-schema";

const rowActionsMock = vi.fn();

vi.mock("./domain-table-row-actions", () => ({
  DomainTableRowActions: (props: { rowId: string }) => {
    rowActionsMock(props);

    return <span data-testid={`row-actions-${props.rowId}`} />;
  },
}));

import {
  buildDomainTableColumns,
  DomainDataTable,
  type DomainDataTableMeta,
} from "./domain-data-table";

const renderedAt = Date.parse("2026-09-28T12:00:00.000Z");

const dateTimeContext = {
  timeZone: "Asia/Jakarta",
  renderedAt,
  now: new Date(renderedAt),
};

const updateSchema = {
  type: "object",
  properties: { symbol: { type: "string" } },
};

const updateFields = parseDomainTableFormFieldsFromJsonSchema(updateSchema);

const buildMeta = (
  overrides: Record<string, unknown> = {},
): DomainDataTableMeta =>
  tableV1MetaResponseSchema.parse({
    title: "Tickers",
    columns: [
      { key: "symbol", label: "Symbol" },
      { key: "name", label: "Name" },
    ],
    sortableFields: ["symbol"],
    actions: { update: true, delete: true, view: true },
    updateSchema,
    ...overrides,
  });

const urlState: ListUrlState = {
  basePath: "/dashboard/mediapulse/tickers",
  page: 1,
  pageSize: 15,
  total: 1,
  sortBy: "symbol",
  sortDir: "asc",
};

const renderTable = (
  overrides: Partial<React.ComponentProps<typeof DomainDataTable>> = {},
  timeZone = dateTimeContext.timeZone,
) => {
  const updateAction = vi.fn();
  const deleteAction = vi.fn();

  render(
    <DateTimeContext value={{ ...dateTimeContext, timeZone }}>
      <DomainDataTable
        tableId="domain-mediapulse-tickers"
        basePath="/dashboard/mediapulse/tickers"
        meta={buildMeta()}
        rows={[{ id: "t-1", symbol: "ACME", name: "Acme Corp" }]}
        urlState={urlState}
        updateFields={updateFields}
        updateAction={updateAction}
        deleteAction={deleteAction}
        {...overrides}
      />
    </DateTimeContext>,
  );

  return { updateAction, deleteAction };
};

const table = () => screen.getByRole("table");

const bodyRow = () => within(table()).getAllByRole("row")[1] as HTMLElement;

const renderValueCell = (
  column: DomainTableColumn,
  value: unknown,
  timeZone?: string,
) => {
  renderTable(
    {
      meta: buildMeta({
        columns: [{ key: "symbol", label: "Symbol" }, column],
        actions: {},
      }),
      rows: [{ id: "t-1", symbol: "ACME", [column.key]: value }],
    },
    timeZone,
  );

  return within(bodyRow()).getAllByRole("cell")[1] as HTMLElement;
};

const valueColumn = (
  overrides: Partial<DomainTableColumn> = {},
): DomainTableColumn => ({
  key: "value",
  label: "Value",
  type: "text",
  ...overrides,
});

describe("buildDomainTableColumns", () => {
  const build = (meta: DomainDataTableMeta = buildMeta()) =>
    buildDomainTableColumns({
      meta,
      basePath: "/dashboard/mediapulse/tickers",
      updateFields,
      updateAction: vi.fn(),
      deleteAction: vi.fn(),
    });

  it("makes the first column an unhideable mobile title", () => {
    const [titleColumn] = build();

    expect(titleColumn?.id).toBe("symbol");
    expect(titleColumn?.enableHiding).toBe(false);
    expect(titleColumn?.meta).toMatchObject({
      label: "Symbol",
      sortKey: "symbol",
      mobile: "title",
    });
  });

  it("maps manifest hints onto the other columns", () => {
    const meta = buildMeta({
      columns: [
        { key: "symbol", label: "Symbol" },
        { key: "sector", label: "Sector", hideBelow: "lg", mobile: "badge" },
        { key: "a", label: "A" },
        { key: "b", label: "B" },
        { key: "c", label: "C" },
        { key: "d", label: "D" },
      ],
      sortableFields: ["sector"],
    });

    const columns = build(meta);

    const metaById = Object.fromEntries(
      columns.map((column) => [column.id, column.meta]),
    );

    expect(metaById.sector).toMatchObject({
      sortKey: "sector",
      hideBelow: "lg",
      mobile: "badge",
    });
    expect(metaById.a).toMatchObject({ sortKey: undefined, mobile: "field" });
    expect(metaById.c).toMatchObject({ mobile: "field" });
    expect(metaById.d).toMatchObject({ mobile: "hidden" });
  });

  it("ends with a row actions column when the manifest allows row actions", () => {
    const columns = build();

    expect(columns.at(-1)?.meta).toMatchObject({ mobile: "actions" });
    expect(columns.at(-1)?.enableHiding).toBe(false);
  });

  it("omits the row actions column without row actions", () => {
    const columns = build(buildMeta({ actions: {} }));

    expect(columns.map((column) => column.id)).toEqual(["symbol", "name"]);
  });
});

describe("DomainDataTable formats", () => {
  afterEach(() => {
    rowActionsMock.mockReset();
  });

  it("truncates text with the full value in a title", () => {
    const longValue = "A very long value that should be truncated in the table";

    const cell = renderValueCell(valueColumn(), longValue);

    const text = within(cell).getByText(longValue);

    expect(text).toHaveClass("truncate");
    expect(text).toHaveAttribute("title", longValue);
  });

  it("renders date-time values in the viewer time zone", () => {
    const cell = renderValueCell(
      valueColumn({ type: "date-time" }),
      "2026-09-28T07:55:00.000Z",
    );

    expect(within(cell).getByText("Sep 28, 14:55")).toHaveAttribute(
      "datetime",
      "2026-09-28T07:55:00.000Z",
    );
  });

  it("renders date-only values without shifting the day", () => {
    const cell = renderValueCell(
      valueColumn({ format: "date" }),
      "2026-09-27",
      "America/New_York",
    );

    expect(cell).toHaveTextContent("Sep 27, 2026");
  });

  it("renders date timestamps as a date in the viewer time zone", () => {
    const cell = renderValueCell(
      valueColumn({ format: "date" }),
      "2026-09-27T20:00:00.000Z",
    );

    expect(cell).toHaveTextContent("Sep 28, 2026");
  });

  it("right-aligns grouped numbers", () => {
    const cell = renderValueCell(valueColumn({ format: "number" }), 1234567);

    const header = within(table()).getByRole("columnheader", {
      name: "Value",
    });

    expect(cell).toHaveTextContent("1,234,567");
    expect(cell).toHaveClass("text-right", "tabular-nums");
    expect(header).toHaveClass("text-right");
  });

  it("renders milliseconds as a short duration", () => {
    const cell = renderValueCell(
      valueColumn({ format: "duration-ms" }),
      130_000,
    );

    expect(cell).toHaveTextContent("2m 10s");
    expect(cell).toHaveClass("text-right");
  });

  it.each([
    { value: true, label: "Yes", tone: "success" },
    { value: false, label: "No", tone: "muted" },
    { value: "true", label: "Yes", tone: "success" },
    { value: "false", label: "No", tone: "muted" },
  ])(
    "renders the boolean $value as a $tone $label badge",
    ({ value, label, tone }) => {
      const cell = renderValueCell(valueColumn({ format: "boolean" }), value);

      expect(within(cell).getByText(label)).toHaveAttribute("data-tone", tone);
    },
  );

  it("lets the manifest override a boolean tone", () => {
    const cell = renderValueCell(
      valueColumn({ format: "boolean", badgeTones: { true: "warning" } }),
      true,
    );

    expect(within(cell).getByText("Yes")).toHaveAttribute(
      "data-tone",
      "warning",
    );
  });

  it("renders badges with the manifest tone", () => {
    const cell = renderValueCell(
      valueColumn({ format: "badge", badgeTones: { sent: "success" } }),
      "sent",
    );

    expect(within(cell).getByText("sent")).toHaveAttribute(
      "data-tone",
      "success",
    );
  });

  it("falls back to the status tone for badge values without a mapping", () => {
    const cell = renderValueCell(
      valueColumn({ format: "badge", badgeTones: { sent: "success" } }),
      "in_progress",
    );

    const badge = within(cell).getByText("in progress");

    expect(badge).toHaveAttribute("data-tone", "neutral");
    expect(badge).toHaveClass("capitalize");
  });

  it.each([
    { format: "text" as const, value: null },
    { format: "number" as const, value: undefined },
    { format: "boolean" as const, value: null },
    { format: "boolean" as const, value: undefined },
    { format: "badge" as const, value: "  " },
  ])("renders an em dash for an empty $format value", ({ format, value }) => {
    const cell = renderValueCell(valueColumn({ format }), value);

    expect(cell).toHaveTextContent("—");
  });

  it("shows the raw value when a format cannot read it", () => {
    const cell = renderValueCell(valueColumn({ format: "number" }), "n/a");

    expect(cell).toHaveTextContent("n/a");
  });
});

describe("DomainDataTable", () => {
  afterEach(() => {
    rowActionsMock.mockReset();
  });

  it("links the title to the detail page when the manifest has a view action", () => {
    renderTable({ rows: [{ id: "t 1", symbol: "ACME", name: "Acme" }] });

    expect(within(table()).getByRole("link", { name: "ACME" })).toHaveAttribute(
      "href",
      "/dashboard/mediapulse/tickers/t%201",
    );
  });

  it("does not link the title without a view action", () => {
    renderTable({ meta: buildMeta({ actions: { update: true } }) });

    expect(within(table()).queryByRole("link")).not.toBeInTheDocument();
    expect(within(table()).getByText("ACME")).toBeInTheDocument();
  });

  it("hands each row to the existing row actions", () => {
    const { updateAction, deleteAction } = renderTable();

    expect(within(table()).getByTestId("row-actions-t-1")).toBeInTheDocument();
    expect(rowActionsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        rowId: "t-1",
        updateAction,
        deleteAction,
        showEdit: true,
        showDelete: true,
        showView: true,
        editHref: undefined,
        viewHref: "/dashboard/mediapulse/tickers/t-1",
      }),
    );
  });

  it("links edit to the full-page editor when the manifest uses full-page navigation", () => {
    renderTable({ meta: buildMeta({ createNavigation: "full-page" }) });

    expect(rowActionsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        editHref: "/dashboard/mediapulse/tickers/t-1/edit",
      }),
    );
  });

  it("marks the sorted column from the URL state", () => {
    renderTable();

    expect(
      within(table()).getByRole("columnheader", { name: "Symbol" }),
    ).toHaveAttribute("aria-sort", "ascending");
    expect(
      within(table()).getByRole("columnheader", { name: "Name" }),
    ).not.toHaveAttribute("aria-sort");
  });

  it("hides responsive columns below their breakpoint", () => {
    renderTable({
      meta: buildMeta({
        columns: [
          { key: "symbol", label: "Symbol" },
          { key: "name", label: "Name", hideBelow: "xl" },
        ],
      }),
    });

    expect(
      within(table()).getByRole("columnheader", { name: "Name" }),
    ).toHaveClass("hidden", "xl:table-cell");
  });

  it("starts defaultHidden columns hidden", () => {
    renderTable({
      meta: buildMeta({
        columns: [
          { key: "symbol", label: "Symbol" },
          { key: "name", label: "Name", defaultHidden: true },
        ],
      }),
    });

    expect(
      within(table()).queryByRole("columnheader", { name: "Name" }),
    ).not.toBeInTheDocument();
  });

  it("uses the saved column visibility over the manifest defaults", () => {
    renderTable({
      meta: buildMeta({
        columns: [
          { key: "symbol", label: "Symbol" },
          { key: "name", label: "Name", defaultHidden: true },
        ],
      }),
      initialColumnVisibility: { name: true },
    });

    expect(
      within(table()).getByRole("columnheader", { name: "Name" }),
    ).toBeInTheDocument();
  });

  it("puts the search, filters and actions in the toolbar", () => {
    renderTable({
      toolbarFilters: <div data-testid="toolbar-filters" />,
      toolbarActions: <button type="button">Reset relations</button>,
    });

    expect(screen.getByPlaceholderText("Filter tickers…")).toBeInTheDocument();
    expect(screen.getByTestId("toolbar-filters")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Reset relations" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Customize columns" }),
    ).toBeInTheDocument();
  });

  it("paginates with the list total", () => {
    renderTable({ urlState: { ...urlState, total: 40 } });

    expect(
      screen.getByRole("navigation", { name: "Tickers list pagination" }),
    ).toBeInTheDocument();
  });

  it("explains an empty list", () => {
    renderTable({ rows: [] });

    expect(screen.getByText("No tickers yet")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("explains an empty filtered list", () => {
    renderTable({
      rows: [],
      urlState: { ...urlState, extra: { sector: "energy" } },
    });

    expect(screen.getByText("No matching tickers")).toBeInTheDocument();
  });
});
