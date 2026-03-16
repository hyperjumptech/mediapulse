import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TickersTable } from "./tickers-table";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

vi.mock("@workspace/ui/components/table", () => ({
  Table: ({ children }: React.PropsWithChildren) => (
    <table data-testid="table">{children}</table>
  ),
  TableHeader: ({ children }: React.PropsWithChildren) => (
    <thead>{children}</thead>
  ),
  TableBody: ({ children }: React.PropsWithChildren) => (
    <tbody>{children}</tbody>
  ),
  TableRow: ({ children }: React.PropsWithChildren) => <tr>{children}</tr>,
  TableHead: ({ children }: React.PropsWithChildren) => <th>{children}</th>,
  TableCell: ({
    children,
    colSpan,
  }: React.PropsWithChildren<{ colSpan?: number }>) => (
    <td colSpan={colSpan}>{children}</td>
  ),
}));

vi.mock("./ticker-detail-dialog", () => ({
  TickerDetailDialog: ({
    tickerId,
    open,
  }: {
    tickerId: string | null;
    open: boolean;
  }) => (
    <div
      data-testid="ticker-detail-dialog"
      data-ticker-id={tickerId ?? "none"}
      data-open={open}
    />
  ),
}));

vi.mock("./ticker-edit-modal", () => ({
  TickerEditModal: ({
    tickerId,
    open,
  }: {
    tickerId: string | null;
    open: boolean;
  }) => (
    <div
      data-testid="ticker-edit-modal"
      data-ticker-id={tickerId ?? "none"}
      data-open={open}
    />
  ),
}));

vi.mock("./ticker-row-actions", () => ({
  TickerRowActions: ({
    tickerId,
    tickerSymbol,
  }: {
    tickerId: string;
    tickerSymbol: string;
  }) => (
    <button data-testid={`row-actions-${tickerId}`} data-symbol={tickerSymbol}>
      Actions
    </button>
  ),
}));

const createMockTicker = (
  overrides?: Partial<{
    id: string;
    symbol: string;
    name: string;
    createdAt: Date;
  }>,
) => ({
  id: "ticker-1",
  symbol: "AAPL",
  name: "Apple Inc.",
  metadata: null,
  createdAt: new Date("2024-01-15"),
  updatedAt: new Date("2024-01-15"),
  ...overrides,
});

describe("TickersTable", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders table headers", () => {
    // Act
    render(
      <TickersTable tickers={[]} sortBy="symbol" sortDir="asc" pageSize={15} />,
    );

    // Assert
    expect(screen.getByText("Symbol")).toBeInTheDocument();
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Created")).toBeInTheDocument();
  });

  it("renders empty state when no tickers", () => {
    // Act
    render(
      <TickersTable tickers={[]} sortBy="symbol" sortDir="asc" pageSize={15} />,
    );

    // Assert
    expect(screen.getByText("No tickers yet.")).toBeInTheDocument();
  });

  it("renders ticker rows when tickers provided", () => {
    // Setup
    const tickers = [createMockTicker()];

    // Act
    render(
      <TickersTable
        tickers={tickers}
        sortBy="symbol"
        sortDir="asc"
        pageSize={15}
      />,
    );

    // Assert
    expect(screen.getByText("AAPL")).toBeInTheDocument();
    expect(screen.getByText("Apple Inc.")).toBeInTheDocument();
  });

  it("renders row actions for each ticker", () => {
    // Setup
    const tickers = [
      createMockTicker({ id: "ticker-1", symbol: "AAPL" }),
      createMockTicker({ id: "ticker-2", symbol: "GOOG" }),
    ];

    // Act
    render(
      <TickersTable
        tickers={tickers}
        sortBy="symbol"
        sortDir="asc"
        pageSize={15}
      />,
    );

    // Assert
    expect(screen.getByTestId("row-actions-ticker-1")).toBeInTheDocument();
    expect(screen.getByTestId("row-actions-ticker-2")).toBeInTheDocument();
  });

  it("opens detail dialog when clicking symbol", () => {
    // Setup
    const tickers = [createMockTicker({ id: "ticker-1" })];

    // Act
    render(
      <TickersTable
        tickers={tickers}
        sortBy="symbol"
        sortDir="asc"
        pageSize={15}
      />,
    );

    const symbolButton = screen.getByRole("button", { name: "AAPL" });
    fireEvent.click(symbolButton);

    // Assert
    expect(screen.getByTestId("ticker-detail-dialog")).toHaveAttribute(
      "data-open",
      "true",
    );
    expect(screen.getByTestId("ticker-detail-dialog")).toHaveAttribute(
      "data-ticker-id",
      "ticker-1",
    );
  });

  it("opens detail dialog when clicking name", () => {
    // Setup
    const tickers = [createMockTicker({ id: "ticker-1" })];

    // Act
    render(
      <TickersTable
        tickers={tickers}
        sortBy="symbol"
        sortDir="asc"
        pageSize={15}
      />,
    );

    const nameButton = screen.getByRole("button", { name: "Apple Inc." });
    fireEvent.click(nameButton);

    // Assert
    expect(screen.getByTestId("ticker-detail-dialog")).toHaveAttribute(
      "data-open",
      "true",
    );
  });

  it("renders sortable column headers as links", () => {
    // Act
    render(
      <TickersTable tickers={[]} sortBy="symbol" sortDir="asc" pageSize={15} />,
    );

    // Assert
    const symbolLink = screen.getByRole("link", { name: /Symbol/i });
    expect(symbolLink).toBeInTheDocument();
  });

  it("renders edit modal", () => {
    // Setup
    const tickers = [createMockTicker()];

    // Act
    render(
      <TickersTable
        tickers={tickers}
        sortBy="symbol"
        sortDir="asc"
        pageSize={15}
      />,
    );

    // Assert
    expect(screen.getByTestId("ticker-edit-modal")).toBeInTheDocument();
  });
});
