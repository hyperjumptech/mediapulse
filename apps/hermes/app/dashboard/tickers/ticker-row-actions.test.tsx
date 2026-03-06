import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi, type Mock } from "vitest";
import { TickerRowActions } from "./ticker-row-actions";

const routerRefreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: routerRefreshMock,
  }),
}));

const createMockFormWithAction = () => {
  const FormWithAction = ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => (
    <form data-testid="delete-form" className={className}>
      {children}
    </form>
  );
  FormWithAction.displayName = "FormWithAction";
  return FormWithAction;
};

const createMockUseFormAction = (overrides?: {
  state?: { status: boolean } | null;
  pending?: boolean;
}) => ({
  FormWithAction: createMockFormWithAction(),
  state: overrides?.state ?? null,
  pending: overrides?.pending ?? false,
});

vi.mock(
  "@/app/dashboard/tickers/actions/delete/.generated/use-form-action",
  () => ({
    useFormAction: vi.fn(() => createMockUseFormAction()),
  }),
);

vi.mock("@workspace/ui/components/dropdown-menu", () => ({
  DropdownMenu: ({ children }: React.PropsWithChildren) => (
    <div data-testid="dropdown-menu">{children}</div>
  ),
  DropdownMenuTrigger: ({ children }: React.PropsWithChildren) => (
    <div data-testid="dropdown-trigger">{children}</div>
  ),
  DropdownMenuContent: ({ children }: React.PropsWithChildren) => (
    <div data-testid="dropdown-content">{children}</div>
  ),
  DropdownMenuItem: ({
    children,
    variant,
    disabled,
  }: React.PropsWithChildren<{ variant?: string; disabled?: boolean }>) => (
    <div
      data-testid="dropdown-item"
      data-variant={variant}
      data-disabled={disabled}
    >
      {children}
    </div>
  ),
  DropdownMenuSeparator: () => <hr data-testid="dropdown-separator" />,
}));

vi.mock("@workspace/ui/components/button", () => ({
  Button: ({
    children,
    "aria-label": ariaLabel,
  }: React.PropsWithChildren<{ "aria-label"?: string }>) => (
    <button aria-label={ariaLabel}>{children}</button>
  ),
}));

const getUseFormActionMock = async () => {
  const mod =
    await import("@/app/dashboard/tickers/actions/delete/.generated/use-form-action");
  return mod.useFormAction as Mock;
};

describe("TickerRowActions", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    routerRefreshMock.mockReset();
  });

  it("renders dropdown menu trigger", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(createMockUseFormAction());

    // Act
    render(<TickerRowActions tickerId="ticker-123" tickerSymbol="AAPL" />);

    // Assert
    expect(
      screen.getByRole("button", { name: "Open menu" }),
    ).toBeInTheDocument();
  });

  it("renders Edit option", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(createMockUseFormAction());

    // Act
    render(<TickerRowActions tickerId="ticker-123" tickerSymbol="AAPL" />);

    // Assert
    expect(screen.getByText("Edit")).toBeInTheDocument();
  });

  it("renders Delete option", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(createMockUseFormAction());

    // Act
    render(<TickerRowActions tickerId="ticker-123" tickerSymbol="AAPL" />);

    // Assert
    expect(screen.getByText("Delete")).toBeInTheDocument();
  });

  it("renders hidden input with ticker id for delete", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(createMockUseFormAction());

    // Act
    render(<TickerRowActions tickerId="ticker-123" tickerSymbol="AAPL" />);

    // Assert
    const form = screen.getByTestId("delete-form");
    const hiddenInput = form.querySelector('input[name="body.tickerId"]');
    expect(hiddenInput).toHaveValue("ticker-123");
  });

  it("shows Deleting label when pending", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(createMockUseFormAction({ pending: true }));

    // Act
    render(<TickerRowActions tickerId="ticker-123" tickerSymbol="AAPL" />);

    // Assert
    expect(screen.getByText("Deleting…")).toBeInTheDocument();
  });

  it("calls router.refresh on successful delete", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(createMockUseFormAction({ state: { status: true } }));

    // Act
    render(<TickerRowActions tickerId="ticker-123" tickerSymbol="AAPL" />);

    // Assert
    expect(routerRefreshMock).toHaveBeenCalled();
  });

  it("renders separator between Edit and Delete", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(createMockUseFormAction());

    // Act
    render(<TickerRowActions tickerId="ticker-123" tickerSymbol="AAPL" />);

    // Assert
    expect(screen.getByTestId("dropdown-separator")).toBeInTheDocument();
  });

  it("applies destructive variant to delete item", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(createMockUseFormAction());

    // Act
    render(<TickerRowActions tickerId="ticker-123" tickerSymbol="AAPL" />);

    // Assert
    const items = screen.getAllByTestId("dropdown-item");
    const deleteItem = items.find((item) =>
      item.textContent?.includes("Delete"),
    );
    expect(deleteItem).toHaveAttribute("data-variant", "destructive");
  });

  it("disables Edit when onEditClick not provided", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(createMockUseFormAction());

    // Act
    render(<TickerRowActions tickerId="ticker-123" tickerSymbol="AAPL" />);

    // Assert
    const items = screen.getAllByTestId("dropdown-item");
    const editItem = items.find((item) => item.textContent?.includes("Edit"));
    expect(editItem).toHaveAttribute("data-disabled", "true");
  });

  it("enables Edit when onEditClick provided", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(createMockUseFormAction());
    const onEditClick = vi.fn();

    // Act
    render(
      <TickerRowActions
        tickerId="ticker-123"
        tickerSymbol="AAPL"
        onEditClick={onEditClick}
      />,
    );

    // Assert
    const items = screen.getAllByTestId("dropdown-item");
    const editItem = items.find((item) => item.textContent?.includes("Edit"));
    expect(editItem).not.toHaveAttribute("data-disabled", "true");
  });
});
