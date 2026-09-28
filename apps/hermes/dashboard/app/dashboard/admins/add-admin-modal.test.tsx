import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AddAdminModal } from "./add-admin-modal";

type MockFormActionState = {
  status: boolean;
  message?: string;
  data?: { id: string };
} | null;

const MockFormWithAction = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <form className={className} data-testid="add-admin-form">
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
  "@/app/dashboard/admins/actions/create/.generated/use-form-action",
  () => ({
    useFormAction: () => useFormActionMock(),
  }),
);

const openModal = () => {
  render(<AddAdminModal trigger={<button type="button">Add admin</button>} />);
  fireEvent.click(screen.getByRole("button", { name: "Add admin" }));
};

describe("AddAdminModal", () => {
  afterEach(() => {
    useFormActionMock.mockReset();
  });

  it("shows the name, email and password fields with footer actions", () => {
    // Act
    openModal();

    // Assert
    expect(screen.getByLabelText("Name")).toHaveAttribute("name", "body.name");
    expect(screen.getByLabelText("Email")).toHaveAttribute(
      "name",
      "body.email",
    );
    expect(screen.getByLabelText("Initial password")).toHaveAttribute(
      "name",
      "body.password",
    );
    expect(
      screen.getByRole("button", { name: "Create admin" }),
    ).toHaveAttribute("type", "submit");
  });

  it("shows the action error and pending label", () => {
    // Setup
    useFormActionMock.mockReturnValue(
      createMockUseFormAction(
        { status: false, message: "Email already used" },
        true,
      ),
    );

    // Act
    openModal();

    // Assert
    expect(screen.getByRole("alert")).toHaveTextContent("Email already used");
    expect(screen.getByRole("button", { name: "Creating…" })).toBeDisabled();
  });

  it("closes when Cancel is clicked", () => {
    // Setup
    openModal();

    // Act
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    // Assert
    expect(screen.queryByTestId("add-admin-form")).not.toBeInTheDocument();
  });
});
