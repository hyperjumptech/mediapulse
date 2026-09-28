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
  }) => <a href={href}>{children}</a>,
}));

vi.mock(
  "@/app/dashboard/agent-configs/actions/delete/.generated/use-form-action",
  () => ({
    useFormAction: useFormActionMock,
  }),
);

vi.mock("@workspace/ui/components/dropdown-menu", () => ({
  DropdownMenu: ({ children }: React.PropsWithChildren) => (
    <div>{children}</div>
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
      <div>{children}</div>
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

import {
  AgentConfigRowActions,
  type AgentConfigRow,
} from "./agent-config-row-actions";

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

const createConfig = (): AgentConfigRow => ({
  id: "config-1",
  name: "Daily digest",
  description: null,
  agentId: "summarizer",
  agentVersion: "2.0.0",
  config: {},
  configSchemaFingerprint: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  createdBy: null,
  schemaValid: true,
});

describe("AgentConfigRowActions", () => {
  afterEach(() => {
    useFormActionMock.mockReset();
    toastErrorMock.mockReset();
  });

  it("links edit and duplicate to the config pages", () => {
    // Setup
    mockFormAction();

    // Act
    render(
      <AgentConfigRowActions
        config={createConfig()}
        configLabel="Daily digest"
      />,
    );

    // Assert
    expect(
      screen.getByRole("button", { name: "Actions for config Daily digest" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Edit/ })).toHaveAttribute(
      "href",
      "/dashboard/agent-configs/config-1/edit",
    );
    expect(screen.getByRole("link", { name: /Duplicate/ })).toHaveAttribute(
      "href",
      "/dashboard/agent-configs/new?duplicate=config-1",
    );
  });

  it("asks for confirmation in a dialog before deleting", () => {
    // Setup
    mockFormAction();
    const confirmSpy = vi.spyOn(window, "confirm");
    render(
      <AgentConfigRowActions
        config={createConfig()}
        configLabel="Daily digest"
      />,
    );

    // Act
    fireEvent.click(screen.getByRole("menuitem", { name: /Delete/ }));

    // Assert
    const dialog = screen.getByRole("alertdialog");
    const hiddenInput = screen
      .getByTestId("delete-form")
      .querySelector('input[name="body.id"]');

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(dialog).toHaveTextContent("Delete config?");
    expect(dialog).toHaveTextContent("Daily digest");
    expect(hiddenInput).toHaveValue("config-1");
    expect(
      screen.getByRole("button", { name: "Delete config" }),
    ).toHaveAttribute("type", "submit");

    confirmSpy.mockRestore();
  });

  it("disables the delete item while the delete is pending", () => {
    // Setup
    mockFormAction({ pending: true });

    // Act
    render(
      <AgentConfigRowActions
        config={createConfig()}
        configLabel="Daily digest"
      />,
    );

    // Assert
    const deleteItem = screen.getByRole("menuitem", { name: /Delete/ });

    expect(deleteItem).toHaveAttribute("data-variant", "destructive");
    expect(deleteItem).toBeDisabled();
  });

  it("toasts the server message when the delete fails", () => {
    // Setup
    mockFormAction({
      state: { status: false, message: "Config is used by 2 pipelines" },
    });

    // Act
    render(
      <AgentConfigRowActions
        config={createConfig()}
        configLabel="Daily digest"
      />,
    );

    // Assert
    expect(toastErrorMock).toHaveBeenCalledWith(
      "Config is used by 2 pipelines",
    );
  });

  it("falls back to a generic toast when the failure has no message", () => {
    // Setup
    mockFormAction({ state: { status: false } });

    // Act
    render(
      <AgentConfigRowActions
        config={createConfig()}
        configLabel="Daily digest"
      />,
    );

    // Assert
    expect(toastErrorMock).toHaveBeenCalledWith("Delete failed");
  });
});
