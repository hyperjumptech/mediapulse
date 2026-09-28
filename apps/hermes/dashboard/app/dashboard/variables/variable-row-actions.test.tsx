import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { VariableRow } from "@/lib/variables";

const { useFormActionMock, toastErrorMock } = vi.hoisted(() => ({
  useFormActionMock: vi.fn(),
  toastErrorMock: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { error: toastErrorMock },
}));

vi.mock(
  "@/app/dashboard/variables/actions/delete/.generated/use-form-action",
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
  DropdownMenuSeparator: () => <hr data-testid="dropdown-separator" />,
}));

import { VariableRowActions } from "./variable-row-actions";

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

const variable: VariableRow = {
  id: "variable-1",
  key: "API_URL",
  value: "https://api.example.com",
  note: null,
  isSecret: false,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  createdBy: null,
};

describe("VariableRowActions", () => {
  afterEach(() => {
    useFormActionMock.mockReset();
    toastErrorMock.mockReset();
  });

  it("calls onEdit from the edit item", () => {
    // Setup
    mockFormAction();
    const onEdit = vi.fn();
    render(
      <VariableRowActions
        variable={variable}
        variableLabel="API_URL"
        onEdit={onEdit}
      />,
    );

    // Act
    fireEvent.click(screen.getByRole("menuitem", { name: /Edit/ }));

    // Assert
    expect(onEdit).toHaveBeenCalledWith(variable);
    expect(
      screen.getByRole("button", { name: "Actions for variable API_URL" }),
    ).toBeInTheDocument();
  });

  it("omits the edit item and separator without onEdit", () => {
    // Setup
    mockFormAction();

    // Act
    render(<VariableRowActions variable={variable} variableLabel="API_URL" />);

    // Assert
    expect(
      screen.queryByRole("menuitem", { name: /Edit/ }),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("dropdown-separator")).not.toBeInTheDocument();
  });

  it("asks for confirmation in a dialog before deleting", () => {
    // Setup
    mockFormAction();
    const confirmSpy = vi.spyOn(window, "confirm");
    render(<VariableRowActions variable={variable} variableLabel="API_URL" />);

    // Act
    fireEvent.click(screen.getByRole("menuitem", { name: /Delete/ }));

    // Assert
    const dialog = screen.getByRole("alertdialog");
    const hiddenInput = screen
      .getByTestId("delete-form")
      .querySelector('input[name="body.id"]');

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(dialog).toHaveTextContent("Delete variable?");
    expect(dialog).toHaveTextContent("API_URL");
    expect(hiddenInput).toHaveValue("variable-1");
    expect(
      screen.getByRole("button", { name: "Delete variable" }),
    ).toHaveAttribute("type", "submit");

    confirmSpy.mockRestore();
  });

  it("disables the delete item while the delete is pending", () => {
    // Setup
    mockFormAction({ pending: true });

    // Act
    render(<VariableRowActions variable={variable} variableLabel="API_URL" />);

    // Assert
    const deleteItem = screen.getByRole("menuitem", { name: /Delete/ });

    expect(deleteItem).toHaveAttribute("data-variant", "destructive");
    expect(deleteItem).toBeDisabled();
  });

  it("toasts when the delete fails", () => {
    // Setup
    mockFormAction({ state: { status: false, message: "Not found" } });

    // Act
    render(<VariableRowActions variable={variable} variableLabel="API_URL" />);

    // Assert
    expect(toastErrorMock).toHaveBeenCalledWith("Not found");
  });
});
