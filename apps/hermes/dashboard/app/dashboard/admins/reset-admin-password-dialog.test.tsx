import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { HermesAdminListRow } from "@/lib/hermes-admins-page";

import { ResetAdminPasswordDialog } from "./reset-admin-password-dialog";

type MockFormActionState = { status: boolean; message?: string } | null;

const submitSpy = vi.fn();

const MockFormWithAction = ({
  children,
  className,
  onSubmit,
}: {
  children: React.ReactNode;
  className?: string;
  onSubmit?: (event: React.FormEvent<HTMLFormElement>) => void;
}) => (
  <form
    className={className}
    data-testid="reset-password-form"
    onSubmit={(event) => {
      onSubmit?.(event);
      submitSpy(event.defaultPrevented);
      event.preventDefault();
    }}
  >
    {children}
  </form>
);

const createMockUseFormAction = (
  state: MockFormActionState = null,
  pending = false,
) => ({
  FormWithAction: MockFormWithAction,
  state,
  pending,
});

const useFormActionMock = vi.fn(() => createMockUseFormAction());

vi.mock(
  "@/app/dashboard/admins/actions/reset-password/.generated/use-form-action",
  () => ({
    useFormAction: () => useFormActionMock(),
  }),
);

const admin: HermesAdminListRow = {
  id: "admin-1",
  name: "Ada",
  email: "ada@example.com",
  isActive: true,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
};

const fillPasswords = (newPassword: string, confirmPassword: string) => {
  fireEvent.change(screen.getByLabelText("New password"), {
    target: { value: newPassword },
  });
  fireEvent.change(screen.getByLabelText("Confirm password"), {
    target: { value: confirmPassword },
  });
};

describe("ResetAdminPasswordDialog", () => {
  afterEach(() => {
    useFormActionMock.mockReset();
    submitSpy.mockReset();
  });

  it("blocks submission and shows an inline error when passwords differ", () => {
    // Setup
    render(
      <ResetAdminPasswordDialog admin={admin} open onOpenChange={vi.fn()} />,
    );
    fillPasswords("secret-1", "secret-2");

    // Act
    fireEvent.submit(screen.getByTestId("reset-password-form"));

    // Assert
    expect(submitSpy).toHaveBeenCalledWith(true);
    expect(screen.getByText("Passwords do not match")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm password")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  it("clears the inline error once the user edits a password", () => {
    // Setup
    render(
      <ResetAdminPasswordDialog admin={admin} open onOpenChange={vi.fn()} />,
    );
    fillPasswords("secret-1", "secret-2");
    fireEvent.submit(screen.getByTestId("reset-password-form"));

    // Act
    fireEvent.change(screen.getByLabelText("Confirm password"), {
      target: { value: "secret-1" },
    });

    // Assert
    expect(
      screen.queryByText("Passwords do not match"),
    ).not.toBeInTheDocument();
  });

  it("lets matching passwords submit to the action", () => {
    // Setup
    render(
      <ResetAdminPasswordDialog admin={admin} open onOpenChange={vi.fn()} />,
    );
    fillPasswords("secret-1", "secret-1");

    // Act
    fireEvent.submit(screen.getByTestId("reset-password-form"));

    // Assert
    expect(submitSpy).toHaveBeenCalledWith(false);
    expect(
      screen.queryByText("Passwords do not match"),
    ).not.toBeInTheDocument();
  });

  it("shows the action error and pending label", () => {
    // Setup
    useFormActionMock.mockReturnValue(
      createMockUseFormAction({ status: false, message: "Too short" }, true),
    );

    // Act
    render(
      <ResetAdminPasswordDialog admin={admin} open onOpenChange={vi.fn()} />,
    );

    // Assert
    expect(screen.getByRole("alert")).toHaveTextContent("Too short");
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
  });

  it("closes when Cancel is clicked", () => {
    // Setup
    const onOpenChange = vi.fn();
    render(
      <ResetAdminPasswordDialog
        admin={admin}
        open
        onOpenChange={onOpenChange}
      />,
    );

    // Act
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    // Assert
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
