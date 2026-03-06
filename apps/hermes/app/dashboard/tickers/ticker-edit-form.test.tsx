import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi, type Mock } from "vitest";
import { TickerEditForm } from "./ticker-edit-form";

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
    <form data-testid="form-with-action" className={className}>
      {children}
    </form>
  );
  FormWithAction.displayName = "FormWithAction";
  return FormWithAction;
};

const createMockUseFormAction = (overrides?: {
  state?: { status: boolean; message?: string } | null;
  pending?: boolean;
}) => ({
  FormWithAction: createMockFormWithAction(),
  state: overrides?.state ?? null,
  pending: overrides?.pending ?? false,
});

vi.mock(
  "@/app/dashboard/tickers/actions/update/.generated/use-form-action",
  () => ({
    useFormAction: vi.fn(() => createMockUseFormAction()),
  }),
);

vi.mock("@workspace/ui/components/button", () => ({
  Button: ({
    children,
    type,
    disabled,
  }: React.PropsWithChildren<{ type?: string; disabled?: boolean }>) => (
    <button type={type as "submit"} disabled={disabled}>
      {children}
    </button>
  ),
}));

vi.mock("@workspace/ui/components/input", () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input {...props} />
  ),
}));

vi.mock("@workspace/ui/components/label", () => ({
  Label: ({
    children,
    htmlFor,
  }: React.PropsWithChildren<{ htmlFor?: string }>) => (
    <label htmlFor={htmlFor}>{children}</label>
  ),
}));

vi.mock("@workspace/ui/lib/utils", () => ({
  cn: (...classes: string[]) => classes.filter(Boolean).join(" "),
}));

const getUseFormActionMock = async () => {
  const mod =
    await import("@/app/dashboard/tickers/actions/update/.generated/use-form-action");
  return mod.useFormAction as Mock;
};

describe("TickerEditForm", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    routerRefreshMock.mockReset();
  });

  it("renders symbol input with initial value", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(createMockUseFormAction());

    // Act
    render(
      <TickerEditForm
        tickerId="ticker-123"
        initialSymbol="AAPL"
        initialName="Apple Inc."
      />,
    );

    // Assert
    expect(screen.getByLabelText("Symbol")).toHaveValue("AAPL");
  });

  it("renders name input with initial value", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(createMockUseFormAction());

    // Act
    render(
      <TickerEditForm
        tickerId="ticker-123"
        initialSymbol="AAPL"
        initialName="Apple Inc."
      />,
    );

    // Assert
    expect(screen.getByLabelText("Name")).toHaveValue("Apple Inc.");
  });

  it("renders metadata textarea with JSON", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(createMockUseFormAction());
    const metadata = { sector: "Technology", industry: "Consumer Electronics" };

    // Act
    render(
      <TickerEditForm
        tickerId="ticker-123"
        initialSymbol="AAPL"
        initialName="Apple Inc."
        initialMetadata={metadata}
      />,
    );

    // Assert
    const textarea = screen.getByLabelText("Metadata (JSON)");
    expect(textarea).toBeInTheDocument();
    expect(textarea).toHaveValue(JSON.stringify(metadata, null, 2));
  });

  it("renders metadata as null when not provided", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(createMockUseFormAction());

    // Act
    render(
      <TickerEditForm
        tickerId="ticker-123"
        initialSymbol="AAPL"
        initialName="Apple Inc."
      />,
    );

    // Assert
    const textarea = screen.getByLabelText("Metadata (JSON)");
    expect(textarea).toHaveValue("null");
  });

  it("renders hidden input with ticker id", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(createMockUseFormAction());

    // Act
    const { container } = render(
      <TickerEditForm
        tickerId="ticker-123"
        initialSymbol="AAPL"
        initialName="Apple Inc."
      />,
    );

    // Assert
    const hiddenInput = container.querySelector('input[name="body.tickerId"]');
    expect(hiddenInput).toHaveValue("ticker-123");
  });

  it("renders save button", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(createMockUseFormAction());

    // Act
    render(
      <TickerEditForm
        tickerId="ticker-123"
        initialSymbol="AAPL"
        initialName="Apple Inc."
      />,
    );

    // Assert
    expect(
      screen.getByRole("button", { name: "Save changes" }),
    ).toBeInTheDocument();
  });

  it("shows Saving label when pending", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(createMockUseFormAction({ pending: true }));

    // Act
    render(
      <TickerEditForm
        tickerId="ticker-123"
        initialSymbol="AAPL"
        initialName="Apple Inc."
      />,
    );

    // Assert
    expect(screen.getByRole("button", { name: "Saving…" })).toBeInTheDocument();
  });

  it("disables inputs when pending", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(createMockUseFormAction({ pending: true }));

    // Act
    render(
      <TickerEditForm
        tickerId="ticker-123"
        initialSymbol="AAPL"
        initialName="Apple Inc."
      />,
    );

    // Assert
    expect(screen.getByLabelText("Symbol")).toBeDisabled();
    expect(screen.getByLabelText("Name")).toBeDisabled();
  });

  it("displays error message when action fails", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(
      createMockUseFormAction({
        state: { status: false, message: "Invalid JSON format" },
      }),
    );

    // Act
    render(
      <TickerEditForm
        tickerId="ticker-123"
        initialSymbol="AAPL"
        initialName="Apple Inc."
      />,
    );

    // Assert
    expect(screen.getByRole("alert")).toHaveTextContent("Invalid JSON format");
  });

  it("calls router.refresh on success", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(createMockUseFormAction({ state: { status: true } }));

    // Act
    render(
      <TickerEditForm
        tickerId="ticker-123"
        initialSymbol="AAPL"
        initialName="Apple Inc."
      />,
    );

    // Assert
    expect(routerRefreshMock).toHaveBeenCalled();
  });

  it("calls onSuccess callback on success", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(createMockUseFormAction({ state: { status: true } }));
    const onSuccess = vi.fn();

    // Act
    render(
      <TickerEditForm
        tickerId="ticker-123"
        initialSymbol="AAPL"
        initialName="Apple Inc."
        onSuccess={onSuccess}
      />,
    );

    // Assert
    expect(onSuccess).toHaveBeenCalled();
  });
});
