import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TickerDetailDialog, metadataToRows } from "./ticker-detail-dialog";

vi.mock("@workspace/ui/components/dialog", () => ({
  Dialog: ({ children, open }: React.PropsWithChildren<{ open?: boolean }>) => (
    <div data-testid="dialog" data-open={open}>
      {children}
    </div>
  ),
  DialogContent: ({ children }: React.PropsWithChildren) => (
    <div data-testid="dialog-content">{children}</div>
  ),
  DialogHeader: ({ children }: React.PropsWithChildren) => (
    <div data-testid="dialog-header">{children}</div>
  ),
  DialogTitle: ({ children }: React.PropsWithChildren) => (
    <h2 data-testid="dialog-title">{children}</h2>
  ),
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
  TableCell: ({ children }: React.PropsWithChildren) => <td>{children}</td>,
}));

const mockTicker = {
  id: "ticker-123",
  symbol: "AAPL",
  name: "Apple Inc.",
  metadata: { sector: "Technology", industry: "Consumer Electronics" },
  createdAt: new Date("2024-01-15"),
  updatedAt: new Date("2024-01-15"),
};

describe("metadataToRows", () => {
  it("returns empty array for null metadata", () => {
    // Act
    const result = metadataToRows(null);

    // Assert
    expect(result).toEqual([]);
  });

  it("returns empty array for undefined metadata", () => {
    // Act
    const result = metadataToRows(undefined);

    // Assert
    expect(result).toEqual([]);
  });

  it("returns sorted key-value pairs for object metadata", () => {
    // Setup
    const metadata = { sector: "Tech", industry: "Software" };

    // Act
    const result = metadataToRows(metadata);

    // Assert
    expect(result).toEqual([
      { key: "industry", value: "Software" },
      { key: "sector", value: "Tech" },
    ]);
  });

  it("stringifies nested objects", () => {
    // Setup
    const metadata = { data: { nested: true } };

    // Act
    const result = metadataToRows(metadata);

    // Assert
    expect(result[0]?.value).toBe('{\n  "nested": true\n}');
  });

  it("handles boolean and number values", () => {
    // Setup
    const metadata = { active: true, count: 42 };

    // Act
    const result = metadataToRows(metadata);

    // Assert
    expect(result).toEqual([
      { key: "active", value: "true" },
      { key: "count", value: "42" },
    ]);
  });
});

describe("TickerDetailDialog", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    global.fetch = vi.fn();
  });

  it("returns null when tickerId is null", () => {
    // Act
    const { container } = render(
      <TickerDetailDialog tickerId={null} open={true} onOpenChange={vi.fn()} />,
    );

    // Assert
    expect(container.firstChild).toBeNull();
  });

  it("renders dialog when tickerId is provided", () => {
    // Setup
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockTicker),
    });

    // Act
    render(
      <TickerDetailDialog
        tickerId="ticker-123"
        open={true}
        onOpenChange={vi.fn()}
      />,
    );

    // Assert
    expect(screen.getByTestId("dialog")).toBeInTheDocument();
    expect(screen.getByTestId("dialog")).toHaveAttribute("data-open", "true");
  });

  it("shows Loading title while fetching", () => {
    // Setup
    global.fetch = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                ok: true,
                json: () => Promise.resolve(mockTicker),
              }),
            1000,
          ),
        ),
    );

    // Act
    render(
      <TickerDetailDialog
        tickerId="ticker-123"
        open={true}
        onOpenChange={vi.fn()}
      />,
    );

    // Assert
    expect(screen.getByTestId("dialog-title")).toHaveTextContent("Loading…");
  });

  it("shows ticker info in title after loading", async () => {
    // Setup
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockTicker),
    });

    // Act
    render(
      <TickerDetailDialog
        tickerId="ticker-123"
        open={true}
        onOpenChange={vi.fn()}
      />,
    );

    // Assert
    await waitFor(() => {
      expect(screen.getByTestId("dialog-title")).toHaveTextContent(
        "AAPL — Apple Inc.",
      );
    });
  });

  it("renders ticker details after loading", async () => {
    // Setup
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockTicker),
    });

    // Act
    render(
      <TickerDetailDialog
        tickerId="ticker-123"
        open={true}
        onOpenChange={vi.fn()}
      />,
    );

    // Assert
    await waitFor(() => {
      expect(screen.getByText("AAPL")).toBeInTheDocument();
      expect(screen.getByText("Apple Inc.")).toBeInTheDocument();
    });
  });

  it("shows error message on fetch failure", async () => {
    // Setup
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ error: "Ticker not found" }),
    });

    // Act
    render(
      <TickerDetailDialog
        tickerId="ticker-123"
        open={true}
        onOpenChange={vi.fn()}
      />,
    );

    // Assert
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Ticker not found");
    });
  });

  it("fetches ticker when opened", () => {
    // Setup
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockTicker),
    });

    // Act
    render(
      <TickerDetailDialog
        tickerId="ticker-123"
        open={true}
        onOpenChange={vi.fn()}
      />,
    );

    // Assert
    expect(global.fetch).toHaveBeenCalledWith("/api/tickers/ticker-123");
  });

  it("renders metadata section when ticker has metadata", async () => {
    // Setup
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockTicker),
    });

    // Act
    render(
      <TickerDetailDialog
        tickerId="ticker-123"
        open={true}
        onOpenChange={vi.fn()}
      />,
    );

    // Assert
    await waitFor(() => {
      expect(screen.getByText("Metadata")).toBeInTheDocument();
      expect(screen.getByText("sector")).toBeInTheDocument();
    });
  });
});
