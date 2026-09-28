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

vi.mock(
  "@/app/dashboard/agent-contracts/actions/delete/.generated/use-form-action",
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
    variant,
    disabled,
    onSelect,
  }: React.PropsWithChildren<{
    variant?: string;
    disabled?: boolean;
    onSelect?: () => void;
  }>) => (
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
  AgentContractRowActions,
  type AgentContractRow,
} from "./agent-contract-row-actions";

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

const contract: AgentContractRow = {
  id: "contract-1",
  name: "Newsletter brief",
  description: null,
  brief: "Write concise summaries.",
  version: "1.0",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  createdBy: null,
};

describe("AgentContractRowActions", () => {
  afterEach(() => {
    useFormActionMock.mockReset();
    toastErrorMock.mockReset();
  });

  it("calls onEdit from the edit item", () => {
    // Setup
    mockFormAction();
    const onEdit = vi.fn();
    render(<AgentContractRowActions contract={contract} onEdit={onEdit} />);

    // Act
    fireEvent.click(screen.getByRole("menuitem", { name: /Edit/ }));

    // Assert
    expect(onEdit).toHaveBeenCalledWith(contract);
    expect(
      screen.getByRole("button", {
        name: "Actions for contract Newsletter brief",
      }),
    ).toBeInTheDocument();
  });

  it("asks for confirmation in a dialog before deleting", () => {
    // Setup
    mockFormAction();
    const confirmSpy = vi.spyOn(window, "confirm");
    render(<AgentContractRowActions contract={contract} onEdit={vi.fn()} />);

    // Act
    fireEvent.click(screen.getByRole("menuitem", { name: /Delete/ }));

    // Assert
    const dialog = screen.getByRole("alertdialog");
    const hiddenInput = screen
      .getByTestId("delete-form")
      .querySelector('input[name="body.id"]');

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(dialog).toHaveTextContent("Delete contract?");
    expect(dialog).toHaveTextContent("Newsletter brief");
    expect(hiddenInput).toHaveValue("contract-1");
    expect(
      screen.getByRole("button", { name: "Delete contract" }),
    ).toHaveAttribute("type", "submit");

    confirmSpy.mockRestore();
  });

  it("disables the delete item while the delete is pending", () => {
    // Setup
    mockFormAction({ pending: true });

    // Act
    render(<AgentContractRowActions contract={contract} onEdit={vi.fn()} />);

    // Assert
    const deleteItem = screen.getByRole("menuitem", { name: /Delete/ });

    expect(deleteItem).toHaveAttribute("data-variant", "destructive");
    expect(deleteItem).toBeDisabled();
  });

  it("toasts the server message when the delete fails", () => {
    // Setup
    mockFormAction({
      state: { status: false, message: "Contract is used by pipelines" },
    });

    // Act
    render(<AgentContractRowActions contract={contract} onEdit={vi.fn()} />);

    // Assert
    expect(toastErrorMock).toHaveBeenCalledWith(
      "Contract is used by pipelines",
    );
  });
});
