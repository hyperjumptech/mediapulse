import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const getTickersPageMock = vi.fn();

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("@/lib/tickers", () => ({
  getTickersPage: (...args: unknown[]) => getTickersPageMock(...args),
}));

vi.mock("./add-import-tickers-modal", () => ({
  AddImportTickersModal: () => (
    <button data-testid="add-import-modal">Add / Import tickers</button>
  ),
}));

vi.mock("./tickers-table", () => ({
  TickersTable: ({
    tickers,
  }: {
    tickers: Array<{ id: string; symbol: string }>;
  }) => (
    <div data-testid="tickers-table" data-count={tickers.length}>
      Table
    </div>
  ),
}));

vi.mock("./pagination", () => ({
  Pagination: ({ page, total }: { page: number; total: number }) => (
    <nav data-testid="pagination" data-page={page} data-total={total}>
      Pagination
    </nav>
  ),
}));

vi.mock("./tickers-search", () => ({
  TickersSearch: ({ initialQuery }: { initialQuery?: string }) => (
    <div data-testid="tickers-search" data-query={initialQuery ?? ""}>
      Search
    </div>
  ),
}));

vi.mock("@/components/with-auth-protection", () => ({
  withAuthProtection: <P extends Record<string, unknown>>(
    Component: (props: P) => React.ReactNode,
  ) => Component,
}));

import TickersPage from "./page";

describe("TickersPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    getTickersPageMock.mockReset();
  });

  it("renders tickers table with data when authenticated", async () => {
    // Setup
    getTickersPageMock.mockResolvedValue({
      tickers: [{ id: "1", symbol: "AAPL", name: "Apple Inc." }],
      total: 1,
      page: 1,
      pageSize: 15,
    });

    // Act
    const component = await TickersPage({ searchParams: {} });
    render(component);

    // Assert
    expect(screen.getByTestId("tickers-table")).toBeInTheDocument();
    expect(screen.getByTestId("tickers-table")).toHaveAttribute(
      "data-count",
      "1",
    );
  });

  it("renders add/import modal button", async () => {
    // Setup
    getTickersPageMock.mockResolvedValue({
      tickers: [],
      total: 0,
      page: 1,
      pageSize: 15,
    });

    // Act
    const component = await TickersPage({ searchParams: {} });
    render(component);

    // Assert
    expect(screen.getByTestId("add-import-modal")).toBeInTheDocument();
  });

  it("renders pagination", async () => {
    // Setup
    getTickersPageMock.mockResolvedValue({
      tickers: [],
      total: 30,
      page: 2,
      pageSize: 15,
    });

    // Act
    const component = await TickersPage({ searchParams: { page: "2" } });
    render(component);

    // Assert
    expect(screen.getByTestId("pagination")).toHaveAttribute("data-page", "2");
    expect(screen.getByTestId("pagination")).toHaveAttribute(
      "data-total",
      "30",
    );
  });

  it("renders search with initial query", async () => {
    // Setup
    getTickersPageMock.mockResolvedValue({
      tickers: [],
      total: 0,
      page: 1,
      pageSize: 15,
    });

    // Act
    const component = await TickersPage({ searchParams: { q: "AAPL" } });
    render(component);

    // Assert
    expect(screen.getByTestId("tickers-search")).toHaveAttribute(
      "data-query",
      "AAPL",
    );
  });

  it("passes search query to getTickersPage", async () => {
    // Setup
    getTickersPageMock.mockResolvedValue({
      tickers: [],
      total: 0,
      page: 1,
      pageSize: 15,
    });

    // Act
    await TickersPage({ searchParams: { q: "test" } });

    // Assert
    expect(getTickersPageMock).toHaveBeenCalledWith(
      1,
      15,
      expect.objectContaining({ search: "test" }),
    );
  });

  it("parses sort parameters correctly", async () => {
    // Setup
    getTickersPageMock.mockResolvedValue({
      tickers: [],
      total: 0,
      page: 1,
      pageSize: 15,
    });

    // Act
    await TickersPage({ searchParams: { sort: "created", dir: "desc" } });

    // Assert
    expect(getTickersPageMock).toHaveBeenCalledWith(
      1,
      15,
      expect.objectContaining({ sortBy: "created", sortDir: "desc" }),
    );
  });
});
