import React from "react";
import { render, screen } from "@testing-library/react";
import { tableV1MetaResponseSchema } from "@hermes/domain-contract";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { DomainTableListParamsParsed } from "@/lib/domain-table-list-params";

const getDomainTableListMock = vi.fn();
const readColumnVisibilityMock = vi.fn();
const domainDataTableMock = vi.fn();

vi.mock("@/lib/require-dashboard-admin", () => ({
  withDashboardAdmin: <Value,>(load: Promise<Value>) => load,
}));

vi.mock("@/lib/domain-dashboard", () => ({
  getDomainTableList: (...args: unknown[]) => getDomainTableListMock(...args),
}));

vi.mock("@/lib/data-table/read-column-visibility", () => ({
  readColumnVisibility: (...args: unknown[]) =>
    readColumnVisibilityMock(...args),
}));

vi.mock("./domain-data-table", () => ({
  DomainDataTable: (props: {
    toolbarFilters?: React.ReactNode;
    toolbarActions?: React.ReactNode;
  }) => {
    domainDataTableMock(props);

    return (
      <div data-testid="domain-data-table">
        {props.toolbarFilters}
        {props.toolbarActions}
      </div>
    );
  },
}));

import { DomainTableSection } from "./domain-table-section";

const meta = tableV1MetaResponseSchema.parse({
  title: "Tickers",
  description: "Listed companies",
  columns: [
    { key: "symbol", label: "Symbol", defaultHidden: true },
    { key: "createdAt", label: "Created", defaultHidden: true },
    { key: "sector", label: "Sector" },
  ],
  sortableFields: ["symbol"],
  actions: { update: true, delete: true },
  createSchema: { type: "object", properties: { symbol: { type: "string" } } },
});

const params: DomainTableListParamsParsed = {
  page: 2,
  pageSize: 15,
  query: "acme",
  sortBy: "symbol",
  sortDir: "desc",
  filters: { sector: "energy" },
};

const renderSection = async () => {
  const updateAction = vi.fn();
  const deleteAction = vi.fn();

  render(
    await DomainTableSection({
      integrationId: "mediapulse",
      resource: "tickers",
      basePath: "/dashboard/mediapulse/tickers",
      meta,
      params,
      updateFields: [],
      updateAction,
      deleteAction,
      toolbarFilters: <div data-testid="filters" />,
      toolbarActions: <div data-testid="actions" />,
    }),
  );

  return { updateAction, deleteAction };
};

const lastTableProps = () =>
  domainDataTableMock.mock.lastCall?.[0] as Record<string, unknown>;

describe("DomainTableSection", () => {
  afterEach(() => {
    getDomainTableListMock.mockReset();
    readColumnVisibilityMock.mockReset();
    domainDataTableMock.mockReset();
  });

  it("loads the page of rows and hands the table its URL state", async () => {
    getDomainTableListMock.mockResolvedValue({
      items: [{ id: "t-1", symbol: "ACME" }],
      total: 40,
      page: 2,
      pageSize: 15,
    });
    readColumnVisibilityMock.mockResolvedValue({});

    const { updateAction, deleteAction } = await renderSection();

    expect(getDomainTableListMock).toHaveBeenCalledWith(
      "mediapulse",
      "tickers",
      params,
    );
    expect(lastTableProps()).toMatchObject({
      tableId: "domain-mediapulse-tickers",
      basePath: "/dashboard/mediapulse/tickers",
      rows: [{ id: "t-1", symbol: "ACME" }],
      urlState: {
        basePath: "/dashboard/mediapulse/tickers",
        page: 2,
        pageSize: 15,
        total: 40,
        search: "acme",
        sortBy: "symbol",
        sortDir: "desc",
        extra: { sector: "energy" },
      },
      updateAction,
      deleteAction,
    });
    expect(screen.getByTestId("filters")).toBeInTheDocument();
    expect(screen.getByTestId("actions")).toBeInTheDocument();
  });

  it("merges saved column choices over the manifest defaults", async () => {
    getDomainTableListMock.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 15,
    });
    readColumnVisibilityMock.mockResolvedValue({ sector: false });

    await renderSection();

    expect(readColumnVisibilityMock).toHaveBeenCalledWith(
      "domain-mediapulse-tickers",
    );
    expect(lastTableProps().initialColumnVisibility).toEqual({
      createdAt: false,
      sector: false,
    });
  });

  it("sends the client only the manifest fields the table needs", async () => {
    getDomainTableListMock.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 15,
    });
    readColumnVisibilityMock.mockResolvedValue({});

    await renderSection();

    expect(Object.keys(lastTableProps().meta as object).sort()).toEqual([
      "actions",
      "columns",
      "createNavigation",
      "sortableFields",
      "title",
    ]);
  });
});
