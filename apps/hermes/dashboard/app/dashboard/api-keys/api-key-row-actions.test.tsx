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
  "@/app/dashboard/api-keys/actions/revoke/.generated/use-form-action",
  () => ({
    useFormAction: () => useFormActionMock(),
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
}));

import { ApiKeyRowActions } from "./api-key-row-actions";

const RevokeForm = ({ children }: React.PropsWithChildren) => (
  <form data-testid="revoke-form">{children}</form>
);

const row = { id: "key-1", label: "Cursor" };

const mockFormAction = (
  overrides: { state?: unknown; pending?: boolean } = {},
) => {
  useFormActionMock.mockReturnValue({
    FormWithAction: RevokeForm,
    state: overrides.state ?? null,
    pending: overrides.pending ?? false,
  });
};

describe("ApiKeyRowActions", () => {
  afterEach(() => {
    useFormActionMock.mockReset();
    toastErrorMock.mockReset();
  });

  it("renders the row menu trigger labelled with the key label", () => {
    // Setup
    mockFormAction();

    // Act
    render(<ApiKeyRowActions row={row} />);

    // Assert
    expect(
      screen.getByRole("button", { name: "Actions for API key Cursor" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("asks for confirmation before revoking the key", () => {
    // Setup
    mockFormAction();
    render(<ApiKeyRowActions row={row} />);

    // Act
    fireEvent.click(screen.getByRole("menuitem", { name: "Revoke" }));

    // Assert
    const dialog = screen.getByRole("alertdialog");
    const hiddenInput = screen
      .getByTestId("revoke-form")
      .querySelector('input[name="body.id"]');

    expect(dialog).toHaveTextContent("Revoke API key?");
    expect(dialog).toHaveTextContent(
      "Requests using Cursor will fail immediately.",
    );
    expect(hiddenInput).toHaveAttribute("value", "key-1");
    expect(screen.getByRole("button", { name: "Revoke" })).toHaveAttribute(
      "type",
      "submit",
    );
  });

  it("disables the menu item while the revoke is pending", () => {
    // Setup
    mockFormAction({ pending: true });

    // Act
    render(<ApiKeyRowActions row={row} />);

    // Assert
    expect(screen.getByRole("menuitem", { name: "Revoke" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("toasts the server error when the revoke fails", () => {
    // Setup
    mockFormAction({ state: { status: false, message: "Key not found" } });

    // Act
    render(<ApiKeyRowActions row={row} />);

    // Assert
    expect(toastErrorMock).toHaveBeenCalledWith("Key not found");
  });
});
