import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { useFormActionMock, toastErrorMock } = vi.hoisted(() => ({
  useFormActionMock: vi.fn(),
  toastErrorMock: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { error: toastErrorMock },
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => (
    <a href={href} data-next-link="">
      {children}
    </a>
  ),
}));

vi.mock(
  "@/app/dashboard/agents/actions/delete/.generated/use-form-action",
  () => ({
    useFormAction: useFormActionMock,
  }),
);

vi.mock("@workspace/ui/components/dropdown-menu", () => ({
  DropdownMenu: ({ children }: React.PropsWithChildren) => (
    <div data-testid="dropdown-menu">{children}</div>
  ),
  DropdownMenuTrigger: ({ children }: React.PropsWithChildren) => (
    <div>{children}</div>
  ),
  DropdownMenuContent: ({ children }: React.PropsWithChildren) => (
    <div role="menu">{children}</div>
  ),
  DropdownMenuItem: ({
    children,
    asChild,
    variant,
    disabled,
    onSelect,
  }: React.PropsWithChildren<{
    asChild?: boolean;
    variant?: string;
    disabled?: boolean;
    onSelect?: () => void;
  }>) =>
    asChild ? (
      <div data-variant={variant}>{children}</div>
    ) : (
      <button
        type="button"
        role="menuitem"
        data-variant={variant}
        disabled={disabled}
        onClick={() => onSelect?.()}
      >
        {children}
      </button>
    ),
  DropdownMenuSeparator: () => <hr />,
}));

import { AgentRowActions } from "./agent-row-actions";

type FormActionState = { status: boolean; message?: string } | null;

const DeleteForm = ({ children }: { children: React.ReactNode }) => (
  <form data-testid="delete-form">{children}</form>
);

const mockFormAction = ({
  state = null,
  pending = false,
}: {
  state?: FormActionState;
  pending?: boolean;
} = {}) => {
  useFormActionMock.mockReturnValue({
    FormWithAction: DeleteForm,
    state,
    pending,
  });
};

const createAgent = () => ({
  id: "agent-123",
  agentId: "test-agent",
  agentVersion: "1.0",
  description: "Test description",
  isActive: true,
  createdAt: new Date("2024-01-15"),
  updatedAt: new Date("2024-01-15"),
  domainIntegration: { integrationId: "mediapulse-local" },
});

describe("AgentRowActions", () => {
  afterEach(() => {
    useFormActionMock.mockReset();
    toastErrorMock.mockReset();
  });

  it("labels the menu trigger with the agent", () => {
    // Setup
    mockFormAction();

    // Act
    render(
      <AgentRowActions agent={createAgent()} agentLabel="test-agent@1.0" />,
    );

    // Assert
    expect(
      screen.getByRole("button", { name: "Actions for agent test-agent@1.0" }),
    ).toBeInTheDocument();
  });

  it("links View details to the agent detail page", () => {
    // Setup
    mockFormAction();

    // Act
    render(
      <AgentRowActions agent={createAgent()} agentLabel="test-agent@1.0" />,
    );

    // Assert
    const viewLink = screen.getByRole("link", { name: /View details/ });

    expect(viewLink).toHaveAttribute("href", "/dashboard/agents/agent-123");
    expect(viewLink).toHaveAttribute("data-next-link");
  });

  it("calls onView instead of linking when provided", () => {
    // Setup
    mockFormAction();
    const onView = vi.fn();
    const agent = createAgent();
    render(
      <AgentRowActions
        agent={agent}
        agentLabel="test-agent@1.0"
        onView={onView}
      />,
    );

    // Act
    fireEvent.click(screen.getByRole("menuitem", { name: /View details/ }));

    // Assert
    expect(onView).toHaveBeenCalledWith(agent);
    expect(
      screen.queryByRole("link", { name: /View details/ }),
    ).not.toBeInTheDocument();
  });

  it("opens a confirmation dialog instead of deleting immediately", () => {
    // Setup
    mockFormAction();
    render(
      <AgentRowActions agent={createAgent()} agentLabel="test-agent@1.0" />,
    );

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();

    // Act
    fireEvent.click(screen.getByRole("menuitem", { name: /Delete/ }));

    // Assert
    const dialog = screen.getByRole("alertdialog");
    const hiddenInput = screen
      .getByTestId("delete-form")
      .querySelector('input[name="body.id"]');

    expect(dialog).toHaveTextContent("Delete agent?");
    expect(dialog).toHaveTextContent("test-agent@1.0");
    expect(hiddenInput).toHaveValue("agent-123");
    expect(
      screen.getByRole("button", { name: "Delete agent" }),
    ).toHaveAttribute("type", "submit");
  });

  it("marks the delete item destructive and disables it while pending", () => {
    // Setup
    mockFormAction({ pending: true });

    // Act
    render(
      <AgentRowActions agent={createAgent()} agentLabel="test-agent@1.0" />,
    );

    // Assert
    const deleteItem = screen.getByRole("menuitem", { name: /Delete/ });

    expect(deleteItem).toHaveAttribute("data-variant", "destructive");
    expect(deleteItem).toBeDisabled();
  });

  it("toasts the server message when the delete fails", () => {
    // Setup
    mockFormAction({ state: { status: false, message: "Agent is in use" } });

    // Act
    render(
      <AgentRowActions agent={createAgent()} agentLabel="test-agent@1.0" />,
    );

    // Assert
    expect(toastErrorMock).toHaveBeenCalledWith("Agent is in use");
  });

  it("does not toast when the delete succeeds", () => {
    // Setup
    mockFormAction({ state: { status: true } });

    // Act
    render(
      <AgentRowActions agent={createAgent()} agentLabel="test-agent@1.0" />,
    );

    // Assert
    expect(toastErrorMock).not.toHaveBeenCalled();
  });
});
