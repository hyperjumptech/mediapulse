import React from "react";
import { render, screen } from "@testing-library/react";
import { format } from "date-fns";
import { tableV1MetaResponseSchema } from "@hermes/domain-contract";
import { afterEach, describe, expect, it, vi } from "vitest";

import { parseDomainTableFormFieldsFromJsonSchema } from "@/lib/domain-table-form-schema";
import type { DomainTableListParamsParsed } from "@/lib/domain-table-list-params";

const getDomainTableListMock = vi.fn();
const rowActionsMock = vi.fn();

vi.mock("@/lib/require-dashboard-admin", () => ({
  withDashboardAdmin: <Value,>(load: Promise<Value>) => load,
}));

vi.mock("@/lib/domain-dashboard", () => ({
  getDomainTableList: (...args: unknown[]) => getDomainTableListMock(...args),
}));

vi.mock("@/app/dashboard/domain-table-row-actions", () => ({
  DomainTableRowActions: (props: { rowId: string }) => {
    rowActionsMock(props);

    return <span data-testid={`row-actions-${props.rowId}`} />;
  },
}));

import {
  DomainTableRowsSection,
  formatDomainTableCellValue,
  type DomainTableColumnForDisplay,
} from "./domain-table-rows-section";

const dateTimeColumn: DomainTableColumnForDisplay = {
  key: "createdAt",
  label: "Created",
  type: "date-time",
};

const textColumn: DomainTableColumnForDisplay = {
  key: "name",
  label: "Name",
  type: "text",
};

const updateSchema = {
  type: "object",
  properties: { symbol: { type: "string" } },
};

const buildMeta = (overrides: Record<string, unknown> = {}) =>
  tableV1MetaResponseSchema.parse({
    title: "Tickers",
    columns: [
      { key: "symbol", label: "Symbol" },
      { key: "active", label: "Active" },
    ],
    actions: { update: true, delete: true, view: true },
    updateSchema,
    ...overrides,
  });

const baseParams: DomainTableListParamsParsed = {
  page: 1,
  pageSize: 15,
  sortDir: "asc",
  filters: {},
};

const renderSection = async (
  meta = buildMeta(),
  params: DomainTableListParamsParsed = baseParams,
) => {
  const updateAction = vi.fn();
  const deleteAction = vi.fn();

  render(
    await DomainTableRowsSection({
      integrationId: "mediapulse",
      resource: "tickers",
      basePath: "/dashboard/mediapulse/tickers",
      meta,
      params,
      updateFields: parseDomainTableFormFieldsFromJsonSchema(updateSchema),
      updateAction,
      deleteAction,
    }),
  );

  return { updateAction, deleteAction };
};

describe("formatDomainTableCellValue", () => {
  it("formats ISO values for date-time columns", () => {
    // Setup
    const iso = "2025-01-01T12:00:00.000Z";
    const expected = format(new Date(iso), "LLL d, yyyy");

    // Act
    const result = formatDomainTableCellValue(dateTimeColumn, iso);

    // Assert
    expect(result).toBe(expected);
    expect(result).not.toBe(iso);
  });

  it("keeps non-date columns as plain string values", () => {
    // Setup
    const value = "alpha";

    // Act
    const result = formatDomainTableCellValue(textColumn, value);

    // Assert
    expect(result).toBe("alpha");
  });

  it("falls back safely for unparseable date-time values", () => {
    // Setup
    const badDate = "not-a-date";

    // Act
    const result = formatDomainTableCellValue(dateTimeColumn, badDate);

    // Assert
    expect(result).toBe("not-a-date");
  });

  it("renders boolean values as Yes/No", () => {
    expect(formatDomainTableCellValue(textColumn, true)).toBe("Yes");
    expect(formatDomainTableCellValue(textColumn, false)).toBe("No");
  });
});

describe("DomainTableRowsSection", () => {
  afterEach(() => {
    getDomainTableListMock.mockReset();
    rowActionsMock.mockReset();
  });

  it("loads the list with the parsed params and renders formatted rows", async () => {
    // Setup
    getDomainTableListMock.mockResolvedValue({
      items: [{ id: "t-1", symbol: "ACME", active: true }],
      total: 40,
      page: 1,
      pageSize: 15,
    });
    const params = { ...baseParams, query: "acme", filters: { sector: "x" } };

    // Act
    const { updateAction, deleteAction } = await renderSection(
      buildMeta(),
      params,
    );

    // Assert
    expect(getDomainTableListMock).toHaveBeenCalledWith(
      "mediapulse",
      "tickers",
      params,
    );
    expect(screen.getByText("ACME")).toBeInTheDocument();
    expect(screen.getByText("Yes")).toBeInTheDocument();
    expect(screen.getByTestId("row-actions-t-1")).toBeInTheDocument();
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
    expect(
      screen.getByRole("navigation", { name: "Tickers list pagination" }),
    ).toBeInTheDocument();
  });

  it("links edit to the full-page editor when the manifest uses full-page navigation", async () => {
    // Setup
    getDomainTableListMock.mockResolvedValue({
      items: [{ id: "t 1", symbol: "ACME" }],
      total: 1,
      page: 1,
      pageSize: 15,
    });

    // Act
    await renderSection(buildMeta({ createNavigation: "full-page" }));

    // Assert
    expect(rowActionsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        editHref: "/dashboard/mediapulse/tickers/t%201/edit",
      }),
    );
  });

  it("renders the empty state instead of the table when there are no rows", async () => {
    // Setup
    getDomainTableListMock.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 15,
    });

    // Act
    await renderSection();

    // Assert
    expect(screen.getByText("No tickers yet")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(rowActionsMock).not.toHaveBeenCalled();
  });

  it.each([
    { name: "a search query", params: { ...baseParams, query: "acme" } },
    {
      name: "an active filter",
      params: { ...baseParams, filters: { sector: "energy" } },
    },
  ])(
    "renders the no results state when $name matches nothing",
    async ({ params }) => {
      // Setup
      getDomainTableListMock.mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        pageSize: 15,
      });

      // Act
      await renderSection(buildMeta(), params);

      // Assert
      expect(screen.getByText("No matching tickers")).toBeInTheDocument();
      expect(screen.queryByText("No tickers yet")).not.toBeInTheDocument();
    },
  );

  it("omits the row actions column when the manifest has no row actions", async () => {
    // Setup
    getDomainTableListMock.mockResolvedValue({
      items: [{ id: "t-1", symbol: "ACME", active: true }],
      total: 1,
      page: 1,
      pageSize: 15,
    });

    // Act
    await renderSection(buildMeta({ actions: {} }));

    // Assert
    expect(screen.getAllByRole("columnheader")).toHaveLength(2);
    expect(screen.getByText("ACME")).not.toHaveAttribute("href");
    expect(rowActionsMock).not.toHaveBeenCalled();
  });

  it("links the first column to the detail view and truncates long values", async () => {
    // Setup
    const longValue = "A very long value that should be truncated in the table";
    getDomainTableListMock.mockResolvedValue({
      items: [{ id: "t 1", symbol: "ACME", active: longValue }],
      total: 1,
      page: 1,
      pageSize: 15,
    });

    // Act
    await renderSection();

    // Assert
    const primaryLink = screen.getByRole("link", { name: "ACME" });
    const longCell = screen.getByText(longValue);

    expect(primaryLink).toHaveAttribute(
      "href",
      "/dashboard/mediapulse/tickers/t%201",
    );
    expect(longCell).toHaveClass("truncate");
    expect(longCell).toHaveAttribute("title", longValue);
  });
});
