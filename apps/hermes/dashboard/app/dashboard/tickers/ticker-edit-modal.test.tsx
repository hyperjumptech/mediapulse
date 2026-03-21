import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TickerEditModal } from "./ticker-edit-modal";

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

vi.mock("./ticker-edit-form", () => ({
  TickerEditForm: ({
    tickerId,
    initialSymbol,
    initialName,
  }: {
    tickerId: string;
    initialSymbol: string;
    initialName: string;
  }) => (
    <div
      data-testid="ticker-edit-form"
      data-ticker-id={tickerId}
      data-symbol={initialSymbol}
      data-name={initialName}
    >
      Edit Form
    </div>
  ),
}));

const mockTicker = {
  id: "ticker-123",
  symbol: "AAPL",
  name: "Apple Inc.",
  metadata: null,
  createdAt: new Date("2024-01-15"),
  updatedAt: new Date("2024-01-15"),
};

describe("TickerEditModal", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    global.fetch = vi.fn();
  });

  it("returns null when tickerId is null", () => {
    // Act
    const { container } = render(
      <TickerEditModal tickerId={null} open={true} onOpenChange={vi.fn()} />,
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
      <TickerEditModal
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
      <TickerEditModal
        tickerId="ticker-123"
        open={true}
        onOpenChange={vi.fn()}
      />,
    );

    // Assert
    expect(screen.getByTestId("dialog-title")).toHaveTextContent("Loading…");
  });

  it("shows ticker symbol in title after loading", async () => {
    // Setup
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockTicker),
    });

    // Act
    render(
      <TickerEditModal
        tickerId="ticker-123"
        open={true}
        onOpenChange={vi.fn()}
      />,
    );

    // Assert
    await waitFor(() => {
      expect(screen.getByTestId("dialog-title")).toHaveTextContent(
        "Edit ticker: AAPL",
      );
    });
  });

  it("renders edit form after loading ticker", async () => {
    // Setup
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockTicker),
    });

    // Act
    render(
      <TickerEditModal
        tickerId="ticker-123"
        open={true}
        onOpenChange={vi.fn()}
      />,
    );

    // Assert
    await waitFor(() => {
      expect(screen.getByTestId("ticker-edit-form")).toBeInTheDocument();
      expect(screen.getByTestId("ticker-edit-form")).toHaveAttribute(
        "data-symbol",
        "AAPL",
      );
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
      <TickerEditModal
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
      <TickerEditModal
        tickerId="ticker-123"
        open={true}
        onOpenChange={vi.fn()}
      />,
    );

    // Assert
    expect(global.fetch).toHaveBeenCalledWith("/api/tickers/ticker-123");
  });
});
