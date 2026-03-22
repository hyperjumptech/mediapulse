import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi, type Mock } from "vitest";
import { AgentRowActions } from "./agent-row-actions";

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
  "@/app/dashboard/agents/actions/delete/.generated/use-form-action",
  () => ({
    useFormAction: vi.fn(() => createMockUseFormAction()),
  }),
);

vi.mock("@workspace/ui/components/dropdown-menu", () => ({
  DropdownMenu: ({ children }: React.PropsWithChildren) => (
    <div data-testid="dropdown-menu">{children}</div>
  ),
  DropdownMenuTrigger: ({
    children,
  }: React.PropsWithChildren<{ asChild?: boolean }>) => (
    <div data-testid="dropdown-trigger">{children}</div>
  ),
  DropdownMenuContent: ({
    children,
    align,
  }: React.PropsWithChildren<{ align?: string }>) => (
    <div data-testid="dropdown-content" data-align={align}>
      {children}
    </div>
  ),
  DropdownMenuItem: ({
    children,
    variant,
    disabled,
  }: React.PropsWithChildren<{
    asChild?: boolean;
    variant?: string;
    disabled?: boolean;
    onSelect?: (e: Event) => void;
  }>) => (
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
    variant,
    size,
    "aria-label": ariaLabel,
  }: React.PropsWithChildren<{
    variant?: string;
    size?: string;
    "aria-label"?: string;
  }>) => (
    <button aria-label={ariaLabel} data-variant={variant} data-size={size}>
      {children}
    </button>
  ),
}));

const createMockAgent = () => ({
  id: "agent-123",
  domainIntegrationId: "di-1",
  agentId: "test-agent",
  agentVersion: "1.0",
  description: "Test description",
  endpoint: { url: "https://example.com" },
  inputSchema: null,
  configSchema: null,
  isActive: true,
  createdAt: new Date("2024-01-15"),
  updatedAt: new Date("2024-01-15"),
});

const getUseFormActionMock = async () => {
  const mod =
    await import("@/app/dashboard/agents/actions/delete/.generated/use-form-action");
  return mod.useFormAction as Mock;
};

describe("AgentRowActions", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    routerRefreshMock.mockReset();
  });

  it("renders dropdown menu trigger", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(createMockUseFormAction());
    const agent = createMockAgent();

    // Act
    render(<AgentRowActions agent={agent} agentLabel="test-agent@1.0" />);

    // Assert
    expect(
      screen.getByRole("button", { name: "Open menu" }),
    ).toBeInTheDocument();
  });

  it("renders View details option", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(createMockUseFormAction());
    const agent = createMockAgent();

    // Act
    render(<AgentRowActions agent={agent} agentLabel="test-agent@1.0" />);

    // Assert
    expect(screen.getByText("View details")).toBeInTheDocument();
  });

  it("renders Delete option", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(createMockUseFormAction());
    const agent = createMockAgent();

    // Act
    render(<AgentRowActions agent={agent} agentLabel="test-agent@1.0" />);

    // Assert
    expect(screen.getByText("Delete")).toBeInTheDocument();
  });

  it("renders View details as link when onView not provided", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(createMockUseFormAction());
    const agent = createMockAgent();

    // Act
    render(<AgentRowActions agent={agent} agentLabel="test-agent@1.0" />);

    // Assert
    const viewLink = screen.getByRole("link", { name: /View details/i });
    expect(viewLink).toHaveAttribute("href", "/dashboard/agents/agent-123");
  });

  it("renders View details as button when onView provided", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(createMockUseFormAction());
    const agent = createMockAgent();
    const onView = vi.fn();

    // Act
    render(
      <AgentRowActions
        agent={agent}
        agentLabel="test-agent@1.0"
        onView={onView}
      />,
    );

    // Assert
    expect(
      screen.queryByRole("link", { name: /View details/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("View details")).toBeInTheDocument();
  });

  it("renders hidden input with agent id for delete", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(createMockUseFormAction());
    const agent = createMockAgent();

    // Act
    render(<AgentRowActions agent={agent} agentLabel="test-agent@1.0" />);

    // Assert
    const form = screen.getByTestId("delete-form");
    const hiddenInput = form.querySelector('input[name="body.id"]');
    expect(hiddenInput).toHaveValue("agent-123");
  });

  it("shows Deleting label when pending", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(createMockUseFormAction({ pending: true }));
    const agent = createMockAgent();

    // Act
    render(<AgentRowActions agent={agent} agentLabel="test-agent@1.0" />);

    // Assert
    expect(screen.getByText("Deleting…")).toBeInTheDocument();
  });

  it("calls router.refresh on successful delete", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(createMockUseFormAction({ state: { status: true } }));
    const agent = createMockAgent();

    // Act
    render(<AgentRowActions agent={agent} agentLabel="test-agent@1.0" />);

    // Assert
    expect(routerRefreshMock).toHaveBeenCalled();
  });

  it("renders separator between View details and Delete", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(createMockUseFormAction());
    const agent = createMockAgent();

    // Act
    render(<AgentRowActions agent={agent} agentLabel="test-agent@1.0" />);

    // Assert
    expect(screen.getByTestId("dropdown-separator")).toBeInTheDocument();
  });

  it("applies destructive variant to delete item", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(createMockUseFormAction());
    const agent = createMockAgent();

    // Act
    render(<AgentRowActions agent={agent} agentLabel="test-agent@1.0" />);

    // Assert
    const items = screen.getAllByTestId("dropdown-item");
    const deleteItem = items.find((item) =>
      item.textContent?.includes("Delete"),
    );
    expect(deleteItem).toHaveAttribute("data-variant", "destructive");
  });
});
