import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ResetPasswordForm } from "./reset-password-form";

type MockFormActionState = { status: boolean; message?: string } | null;

const pushMock = vi.fn();

const MockFormWithAction = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <form className={className} data-testid="reset-password-form">
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

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: React.PropsWithChildren<{ href: string }>) => (
    <a href={href}>{children}</a>
  ),
}));

describe("ResetPasswordForm", () => {
  afterEach(() => {
    useFormActionMock.mockReset();
    pushMock.mockReset();
  });

  it("posts the token with both password fields", () => {
    // Act
    render(<ResetPasswordForm token="token-1" />);

    // Assert
    const formData = new FormData(
      screen.getByTestId("reset-password-form") as HTMLFormElement,
    );

    expect(formData.get("body.token")).toBe("token-1");
    expect(screen.getByLabelText("New password")).toHaveAttribute(
      "name",
      "body.newPassword",
    );
    expect(screen.getByLabelText("Confirm password")).toHaveAttribute(
      "name",
      "body.confirmPassword",
    );
    expect(
      screen.getByRole("link", { name: "Request a new link" }),
    ).toHaveAttribute("href", "/login/forgot-password");
  });

  it("shows the action error and the pending label", () => {
    // Setup
    useFormActionMock.mockReturnValue(
      createMockUseFormAction({ status: false, message: "Link expired" }, true),
    );

    // Act
    render(<ResetPasswordForm token="token-1" />);

    // Assert
    expect(screen.getByRole("alert")).toHaveTextContent("Link expired");
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
  });

  it("redirects to login after a successful reset", () => {
    // Setup
    useFormActionMock.mockReturnValue(
      createMockUseFormAction({ status: true }),
    );

    // Act
    render(<ResetPasswordForm token="token-1" />);

    // Assert
    expect(pushMock).toHaveBeenCalledWith("/login");
  });
});
