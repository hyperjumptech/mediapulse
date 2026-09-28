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
  "@/app/dashboard/domain-integrations/actions/delete/.generated/use-form-action",
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

import { DomainIntegrationRowActions } from "./domain-integration-row-actions";

const DeleteForm = ({ children }: React.PropsWithChildren) => (
  <form data-testid="delete-form">{children}</form>
);

const row = { id: "integration-1", integrationId: "acme", name: "Acme" };

const mockFormAction = (
  overrides: { state?: unknown; pending?: boolean } = {},
) => {
  useFormActionMock.mockReturnValue({
    FormWithAction: DeleteForm,
    state: overrides.state ?? null,
    pending: overrides.pending ?? false,
  });
};

describe("DomainIntegrationRowActions", () => {
  afterEach(() => {
    useFormActionMock.mockReset();
    toastErrorMock.mockReset();
  });

  it("renders the row menu trigger labelled with the integration id", () => {
    // Setup
    mockFormAction();

    // Act
    render(<DomainIntegrationRowActions row={row} />);

    // Assert
    expect(
      screen.getByRole("button", { name: "Actions for integration acme" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("asks for confirmation before deleting the integration", () => {
    // Setup
    mockFormAction();
    render(<DomainIntegrationRowActions row={row} />);

    // Act
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));

    // Assert
    const dialog = screen.getByRole("alertdialog");
    const hiddenInput = screen
      .getByTestId("delete-form")
      .querySelector('input[name="body.id"]');

    expect(dialog).toHaveTextContent("Delete domain integration?");
    expect(dialog).toHaveTextContent(
      "This deletes acme (Acme). You cannot delete it while pipelines still reference it.",
    );
    expect(hiddenInput).toHaveAttribute("value", "integration-1");
    expect(screen.getByRole("button", { name: "Delete" })).toHaveAttribute(
      "type",
      "submit",
    );
  });

  it("disables the menu item while the delete is pending", () => {
    // Setup
    mockFormAction({ pending: true });

    // Act
    render(<DomainIntegrationRowActions row={row} />);

    // Assert
    expect(screen.getByRole("menuitem", { name: "Delete" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("toasts the server error when the delete fails", () => {
    // Setup
    mockFormAction({
      state: { status: false, message: "Pipelines still use it" },
    });

    // Act
    render(<DomainIntegrationRowActions row={row} />);

    // Assert
    expect(toastErrorMock).toHaveBeenCalledWith("Pipelines still use it");
  });
});
