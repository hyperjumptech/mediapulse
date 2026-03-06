import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi, type Mock } from "vitest";
import { AddAgentModal } from "./add-agent-modal";

const routerPushMock = vi.fn();
const routerRefreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: routerPushMock,
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
  "@/app/dashboard/agents/actions/create/.generated/use-form-action",
  () => ({
    useFormAction: vi.fn(() => createMockUseFormAction()),
  }),
);

vi.mock("@workspace/ui/components/dialog", () => ({
  Dialog: ({
    children,
    open,
    onOpenChange,
  }: React.PropsWithChildren<{
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
  }>) => (
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
  DialogTrigger: ({
    children,
    asChild,
  }: React.PropsWithChildren<{ asChild?: boolean }>) => (
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

vi.mock("./agent-form-fields", () => ({
  AgentFormFields: ({
    mode,
    pending,
    errorMessage,
    submitLabel,
  }: {
    mode: string;
    pending: boolean;
    errorMessage: string | null;
    submitLabel: string;
  }) => (
    <div
      data-testid="agent-form-fields"
      data-mode={mode}
      data-pending={pending}
      data-error={errorMessage}
    >
      <button type="submit">{submitLabel}</button>
    </div>
  ),
}));

const getUseFormActionMock = async () => {
  const mod =
    await import("@/app/dashboard/agents/actions/create/.generated/use-form-action");
  return mod.useFormAction as Mock;
};

describe("AddAgentModal", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    routerPushMock.mockReset();
    routerRefreshMock.mockReset();
  });

  it("renders Add agent trigger button", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(createMockUseFormAction());

    // Act
    render(<AddAgentModal />);

    // Assert
    expect(
      screen.getByRole("button", { name: "Add agent" }),
    ).toBeInTheDocument();
  });

  it("renders dialog title", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(createMockUseFormAction());

    // Act
    render(<AddAgentModal />);

    // Assert
    expect(screen.getByTestId("dialog-title")).toHaveTextContent("Add agent");
  });

  it("renders form fields in create mode", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(createMockUseFormAction());

    // Act
    render(<AddAgentModal />);

    // Assert
    expect(screen.getByTestId("agent-form-fields")).toHaveAttribute(
      "data-mode",
      "create",
    );
  });

  it("shows Creating label when pending", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(createMockUseFormAction({ pending: true }));

    // Act
    render(<AddAgentModal />);

    // Assert
    expect(
      screen.getByRole("button", { name: "Creating…" }),
    ).toBeInTheDocument();
  });

  it("shows Create agent label when not pending", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(createMockUseFormAction({ pending: false }));

    // Act
    render(<AddAgentModal />);

    // Assert
    expect(
      screen.getByRole("button", { name: "Create agent" }),
    ).toBeInTheDocument();
  });

  it("displays error message when action fails", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(
      createMockUseFormAction({
        state: { status: false, message: "Agent ID already exists" },
      }),
    );

    // Act
    render(<AddAgentModal />);

    // Assert
    expect(screen.getByTestId("agent-form-fields")).toHaveAttribute(
      "data-error",
      "Agent ID already exists",
    );
  });

  it("calls router.refresh on success", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(
      createMockUseFormAction({
        state: { status: true, data: { id: "new-agent-id" } },
      }),
    );

    // Act
    render(<AddAgentModal />);

    // Assert
    expect(routerRefreshMock).toHaveBeenCalled();
  });
});
