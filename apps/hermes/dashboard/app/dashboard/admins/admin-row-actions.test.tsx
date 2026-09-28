import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { useDeleteFormActionMock, useSetActiveFormActionMock, toastErrorMock } =
  vi.hoisted(() => ({
    useDeleteFormActionMock: vi.fn(),
    useSetActiveFormActionMock: vi.fn(),
    toastErrorMock: vi.fn(),
  }));

vi.mock("sonner", () => ({
  toast: { error: toastErrorMock },
}));

vi.mock(
  "@/app/dashboard/admins/actions/delete/.generated/use-form-action",
  () => ({
    useFormAction: () => useDeleteFormActionMock(),
  }),
);

vi.mock(
  "@/app/dashboard/admins/actions/set-active/.generated/use-form-action",
  () => ({
    useFormAction: () => useSetActiveFormActionMock(),
  }),
);

vi.mock("./reset-admin-password-dialog", () => ({
  ResetAdminPasswordDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="reset-password-dialog" /> : null,
}));

vi.mock("@workspace/ui/components/dropdown-menu", () => ({
  DropdownMenu: ({ children }: React.PropsWithChildren) => (
    <div>{children}</div>
  ),
  DropdownMenuTrigger: ({ children }: React.PropsWithChildren) => (
    <div>{children}</div>
  ),
  DropdownMenuContent: ({ children }: React.PropsWithChildren) => (
    <div>{children}</div>
  ),
  DropdownMenuItem: ({
    children,
    onSelect,
    disabled,
  }: React.PropsWithChildren<{
    onSelect?: (event: Event) => void;
    disabled?: boolean;
  }>) => (
    <div
      role="menuitem"
      aria-disabled={disabled}
      onClick={() => onSelect?.(new Event("select"))}
    >
      {children}
    </div>
  ),
  DropdownMenuSeparator: () => <hr />,
}));

import { AdminRowActions } from "./admin-row-actions";

const DeleteForm = ({ children }: React.PropsWithChildren) => (
  <form data-testid="delete-form">{children}</form>
);

const SetActiveForm = ({ children }: React.PropsWithChildren) => (
  <form data-testid="set-active-form">{children}</form>
);

const activeAdmin = {
  id: "user-2",
  name: "Grace",
  email: "grace@example.com",
  isActive: true,
  createdAt: new Date("2026-01-03T00:00:00.000Z"),
};

const mockActions = (
  overrides: { deleteState?: unknown; deletePending?: boolean } = {},
) => {
  useDeleteFormActionMock.mockReturnValue({
    FormWithAction: DeleteForm,
    state: overrides.deleteState ?? null,
    pending: overrides.deletePending ?? false,
  });
  useSetActiveFormActionMock.mockReturnValue({
    FormWithAction: SetActiveForm,
    state: null,
    pending: false,
  });
};

describe("AdminRowActions", () => {
  afterEach(() => {
    useDeleteFormActionMock.mockReset();
    useSetActiveFormActionMock.mockReset();
    toastErrorMock.mockReset();
  });

  it("renders the row menu trigger labelled with the admin email", () => {
    // Setup
    mockActions();

    // Act
    render(<AdminRowActions admin={activeAdmin} currentUserId="user-1" />);

    // Assert
    expect(
      screen.getByRole("button", {
        name: "Actions for admin grace@example.com",
      }),
    ).toBeInTheDocument();
  });

  it("opens the reset password dialog from the menu", () => {
    // Setup
    mockActions();
    render(<AdminRowActions admin={activeAdmin} currentUserId="user-1" />);

    // Act
    fireEvent.click(screen.getByRole("menuitem", { name: "Reset password" }));

    // Assert
    expect(screen.getByTestId("reset-password-dialog")).toBeInTheDocument();
  });

  it("asks for confirmation before deleting another admin", () => {
    // Setup
    mockActions();
    render(<AdminRowActions admin={activeAdmin} currentUserId="user-1" />);

    // Act
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));

    // Assert
    const dialog = screen.getByRole("alertdialog");
    const hiddenInput = screen
      .getByTestId("delete-form")
      .querySelector('input[name="body.id"]');

    expect(dialog).toHaveTextContent("Delete admin?");
    expect(dialog).toHaveTextContent(
      "grace@example.com will lose access to the dashboard.",
    );
    expect(hiddenInput).toHaveAttribute("value", "user-2");
  });

  it("disables delete and disable for the current user", () => {
    // Setup
    mockActions();

    // Act
    render(<AdminRowActions admin={activeAdmin} currentUserId="user-2" />);

    // Assert
    expect(screen.getByRole("menuitem", { name: "Delete" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByRole("menuitem", { name: "Disable" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("submits the matching active flag for active and disabled admins", () => {
    // Setup
    mockActions();
    const disabledAdmin = { ...activeAdmin, isActive: false };

    // Act
    const { rerender } = render(
      <AdminRowActions admin={activeAdmin} currentUserId="user-1" />,
    );
    const disableValue = screen
      .getByTestId("set-active-form")
      .querySelector('input[name="body.active"]');

    // Assert
    expect(disableValue).toHaveAttribute("value", "false");

    rerender(<AdminRowActions admin={disabledAdmin} currentUserId="user-1" />);

    const enableValue = screen
      .getByTestId("set-active-form")
      .querySelector('input[name="body.active"]');

    expect(screen.getByRole("button", { name: "Enable" })).toBeInTheDocument();
    expect(enableValue).toHaveAttribute("value", "true");
  });

  it("toasts the server error when the delete fails", () => {
    // Setup
    mockActions({
      deleteState: {
        status: false,
        message: "You cannot delete your own account",
      },
    });

    // Act
    render(<AdminRowActions admin={activeAdmin} currentUserId="user-1" />);

    // Assert
    expect(toastErrorMock).toHaveBeenCalledWith(
      "You cannot delete your own account",
    );
  });
});
