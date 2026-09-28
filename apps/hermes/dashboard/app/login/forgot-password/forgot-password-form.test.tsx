import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ForgotPasswordForm } from "./forgot-password-form";

type MockFormActionState = { status: boolean; message?: string } | null;

const MockFormWithAction = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <form className={className} data-testid="forgot-password-form">
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

vi.mock("./action/.generated/use-form-action", () => ({
  useFormAction: () => useFormActionMock(),
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: React.PropsWithChildren<{ href: string }>) => (
    <a href={href}>{children}</a>
  ),
}));

describe("ForgotPasswordForm", () => {
  afterEach(() => {
    useFormActionMock.mockReset();
  });

  it("renders the email field, a full width submit and a link back to login", () => {
    // Act
    render(<ForgotPasswordForm />);

    // Assert
    expect(screen.getByLabelText("Email")).toHaveAttribute(
      "name",
      "body.email",
    );
    expect(screen.getByRole("button", { name: "Send reset link" })).toHaveClass(
      "w-full",
    );
    expect(screen.getByRole("link", { name: "Back to login" })).toHaveAttribute(
      "href",
      "/login",
    );
  });

  it("confirms the request with a status message", () => {
    // Setup
    useFormActionMock.mockReturnValue(
      createMockUseFormAction({ status: true }),
    );

    // Act
    render(<ForgotPasswordForm />);

    // Assert
    expect(screen.getByRole("status")).toHaveTextContent(
      "If an account exists for that email, we sent a reset link.",
    );
  });

  it("shows the action error and the pending label", () => {
    // Setup
    useFormActionMock.mockReturnValue(
      createMockUseFormAction(
        { status: false, message: "Too many requests" },
        true,
      ),
    );

    // Act
    render(<ForgotPasswordForm />);

    // Assert
    expect(screen.getByRole("alert")).toHaveTextContent("Too many requests");
    expect(screen.getByRole("button", { name: "Sending…" })).toBeDisabled();
  });
});
