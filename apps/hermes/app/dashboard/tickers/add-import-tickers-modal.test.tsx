import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi, type Mock } from "vitest";
import { AddImportTickersModal } from "./add-import-tickers-modal";

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
  state?: { status: boolean; data?: { id: string }; message?: string } | null;
  pending?: boolean;
}) => ({
  FormWithAction: createMockFormWithAction(),
  state: overrides?.state ?? null,
  pending: overrides?.pending ?? false,
});

vi.mock(
  "@/app/dashboard/tickers/actions/create/.generated/use-form-action",
  () => ({
    useFormAction: vi.fn(() => createMockUseFormAction()),
  }),
);

vi.mock("@/app/dashboard/tickers/actions/import/.generated/client", () => ({
  RouteClient: vi.fn().mockImplementation(() => ({
    post: vi.fn().mockResolvedValue({ added: 0, updated: 0 }),
  })),
}));

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
  DialogTrigger: ({ children }: React.PropsWithChildren) => (
    <div data-testid="dialog-trigger">{children}</div>
  ),
}));

vi.mock("@workspace/ui/components/button", () => ({
  Button: ({
    children,
    type,
    disabled,
  }: React.PropsWithChildren<{ type?: string; disabled?: boolean }>) => (
    <button type={type as "submit" | "button"} disabled={disabled}>
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

vi.mock("@workspace/ui/components/tabs", () => ({
  Tabs: ({ children }: React.PropsWithChildren) => (
    <div data-testid="tabs">{children}</div>
  ),
  TabsList: ({ children }: React.PropsWithChildren) => (
    <div data-testid="tabs-list">{children}</div>
  ),
  TabsTrigger: ({
    children,
    value,
  }: React.PropsWithChildren<{ value: string }>) => (
    <button data-testid={`tab-trigger-${value}`}>{children}</button>
  ),
  TabsContent: ({
    children,
    value,
  }: React.PropsWithChildren<{ value: string }>) => (
    <div data-testid={`tab-content-${value}`}>{children}</div>
  ),
}));

const getUseFormActionMock = async () => {
  const mod =
    await import("@/app/dashboard/tickers/actions/create/.generated/use-form-action");
  return mod.useFormAction as Mock;
};

describe("AddImportTickersModal", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    routerRefreshMock.mockReset();
  });

  it("renders trigger button", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(createMockUseFormAction());

    // Act
    render(<AddImportTickersModal />);

    // Assert
    expect(
      screen.getByRole("button", { name: "Add / Import tickers" }),
    ).toBeInTheDocument();
  });

  it("renders dialog title", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(createMockUseFormAction());

    // Act
    render(<AddImportTickersModal />);

    // Assert
    expect(screen.getByTestId("dialog-title")).toHaveTextContent(
      "Add or import tickers",
    );
  });

  it("renders create and import tabs", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(createMockUseFormAction());

    // Act
    render(<AddImportTickersModal />);

    // Assert
    expect(screen.getByTestId("tab-trigger-create")).toHaveTextContent(
      "Create new ticker",
    );
    expect(screen.getByTestId("tab-trigger-import")).toHaveTextContent(
      "Import from JSON",
    );
  });

  it("renders symbol and name fields in create tab", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(createMockUseFormAction());

    // Act
    render(<AddImportTickersModal />);

    // Assert
    expect(screen.getByLabelText("Symbol")).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
  });

  it("renders create ticker button", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(createMockUseFormAction());

    // Act
    render(<AddImportTickersModal />);

    // Assert
    expect(
      screen.getByRole("button", { name: "Create ticker" }),
    ).toBeInTheDocument();
  });

  it("shows Creating label when pending", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(createMockUseFormAction({ pending: true }));

    // Act
    render(<AddImportTickersModal />);

    // Assert
    expect(
      screen.getByRole("button", { name: "Creating…" }),
    ).toBeInTheDocument();
  });

  it("displays error message when create fails", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(
      createMockUseFormAction({
        state: { status: false, message: "Symbol already exists" },
      }),
    );

    // Act
    render(<AddImportTickersModal />);

    // Assert
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Symbol already exists",
    );
  });

  it("renders file input in import tab", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(createMockUseFormAction());

    // Act
    render(<AddImportTickersModal />);

    // Assert
    const fileInput = document.querySelector('input[type="file"]');
    expect(fileInput).toBeInTheDocument();
  });

  it("renders import button in import tab", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(createMockUseFormAction());

    // Act
    render(<AddImportTickersModal />);

    // Assert
    expect(screen.getByRole("button", { name: "Import" })).toBeInTheDocument();
  });

  it("calls router.refresh on success", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(
      createMockUseFormAction({
        state: { status: true, data: { id: "new-ticker" } },
      }),
    );

    // Act
    render(<AddImportTickersModal />);

    // Assert
    expect(routerRefreshMock).toHaveBeenCalled();
  });
});
