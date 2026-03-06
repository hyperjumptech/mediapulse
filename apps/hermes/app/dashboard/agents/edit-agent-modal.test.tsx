import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi, type Mock } from "vitest";
import { EditAgentModal } from "./edit-agent-modal";

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
  "@/app/dashboard/agents/actions/update/.generated/use-form-action",
  () => ({
    useFormAction: vi.fn(() => createMockUseFormAction()),
  }),
);

vi.mock("@workspace/ui/components/dialog", () => ({
  Dialog: ({
    children,
    open,
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
}));

vi.mock("./agent-form-fields", () => ({
  AgentFormFields: ({
    mode,
    id,
    initialAgentId,
    pending,
    errorMessage,
    submitLabel,
  }: {
    mode: string;
    id?: string;
    initialAgentId?: string;
    initialAgentVersion?: string;
    pending: boolean;
    errorMessage: string | null;
    submitLabel: string;
  }) => (
    <div
      data-testid="agent-form-fields"
      data-mode={mode}
      data-id={id}
      data-agent-id={initialAgentId}
      data-pending={pending}
      data-error={errorMessage}
    >
      <button type="submit">{submitLabel}</button>
    </div>
  ),
}));

const createMockAgent = () => ({
  id: "agent-123",
  agentId: "test-agent",
  agentVersion: "1.0",
  description: "Test description",
  endpoint: { url: "https://example.com" },
  isActive: true,
  createdAt: new Date("2024-01-15"),
  updatedAt: new Date("2024-01-15"),
});

const getUseFormActionMock = async () => {
  const mod =
    await import("@/app/dashboard/agents/actions/update/.generated/use-form-action");
  return mod.useFormAction as Mock;
};

describe("EditAgentModal", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    routerRefreshMock.mockReset();
  });

  it("returns null when agent is null", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(createMockUseFormAction());

    // Act
    const { container } = render(
      <EditAgentModal agent={null} open={true} onOpenChange={vi.fn()} />,
    );

    // Assert
    expect(container.firstChild).toBeNull();
  });

  it("renders dialog with agent info in title", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(createMockUseFormAction());
    const agent = createMockAgent();

    // Act
    render(<EditAgentModal agent={agent} open={true} onOpenChange={vi.fn()} />);

    // Assert
    expect(screen.getByTestId("dialog-title")).toHaveTextContent(
      "Edit agent: test-agent@1.0",
    );
  });

  it("renders form fields in edit mode", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(createMockUseFormAction());
    const agent = createMockAgent();

    // Act
    render(<EditAgentModal agent={agent} open={true} onOpenChange={vi.fn()} />);

    // Assert
    expect(screen.getByTestId("agent-form-fields")).toHaveAttribute(
      "data-mode",
      "edit",
    );
  });

  it("passes agent id to form fields", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(createMockUseFormAction());
    const agent = createMockAgent();

    // Act
    render(<EditAgentModal agent={agent} open={true} onOpenChange={vi.fn()} />);

    // Assert
    expect(screen.getByTestId("agent-form-fields")).toHaveAttribute(
      "data-id",
      "agent-123",
    );
  });

  it("shows Saving label when pending", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(createMockUseFormAction({ pending: true }));
    const agent = createMockAgent();

    // Act
    render(<EditAgentModal agent={agent} open={true} onOpenChange={vi.fn()} />);

    // Assert
    expect(screen.getByRole("button", { name: "Saving…" })).toBeInTheDocument();
  });

  it("shows Save changes label when not pending", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(createMockUseFormAction({ pending: false }));
    const agent = createMockAgent();

    // Act
    render(<EditAgentModal agent={agent} open={true} onOpenChange={vi.fn()} />);

    // Assert
    expect(
      screen.getByRole("button", { name: "Save changes" }),
    ).toBeInTheDocument();
  });

  it("displays error message when action fails", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(
      createMockUseFormAction({
        state: { status: false, message: "Invalid endpoint" },
      }),
    );
    const agent = createMockAgent();

    // Act
    render(<EditAgentModal agent={agent} open={true} onOpenChange={vi.fn()} />);

    // Assert
    expect(screen.getByTestId("agent-form-fields")).toHaveAttribute(
      "data-error",
      "Invalid endpoint",
    );
  });

  it("calls router.refresh on success", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(createMockUseFormAction({ state: { status: true } }));
    const agent = createMockAgent();
    const onOpenChange = vi.fn();

    // Act
    render(
      <EditAgentModal agent={agent} open={true} onOpenChange={onOpenChange} />,
    );

    // Assert
    expect(routerRefreshMock).toHaveBeenCalled();
  });

  it("calls onOpenChange(false) on success", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(createMockUseFormAction({ state: { status: true } }));
    const agent = createMockAgent();
    const onOpenChange = vi.fn();

    // Act
    render(
      <EditAgentModal agent={agent} open={true} onOpenChange={onOpenChange} />,
    );

    // Assert
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("passes open state to dialog", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(createMockUseFormAction());
    const agent = createMockAgent();

    // Act
    render(<EditAgentModal agent={agent} open={true} onOpenChange={vi.fn()} />);

    // Assert
    expect(screen.getByTestId("dialog")).toHaveAttribute("data-open", "true");
  });
});
