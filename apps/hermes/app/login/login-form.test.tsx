import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi, type Mock } from "vitest";
import { LoginForm } from "./login-form";

const pushMock = vi.fn();

/**
 * Creates a predictable form wrapper for `useFormAction` tests.
 */
const createMockFormWithAction = () => {
  const FormWithAction = ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => (
    <form data-testid="login-form" className={className}>
      {children}
    </form>
  );
  FormWithAction.displayName = "FormWithAction";
  return FormWithAction;
};

/**
 * Creates a default shape that mirrors `useFormAction` output.
 */
const createMockUseFormAction = (overrides?: {
  state?: {
    status: boolean;
    message?: string;
    data?: { id: string; name: string; email: string };
  } | null;
  pending?: boolean;
}) => ({
  FormWithAction: createMockFormWithAction(),
  state: overrides?.state ?? null,
  pending: overrides?.pending ?? false,
});

vi.mock("./action/.generated/use-form-action", () => ({
  useFormAction: vi.fn(() => createMockUseFormAction()),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

/**
 * Returns the mocked `useFormAction` function.
 */
const getUseFormActionMock = async () => {
  const mod = await import("./action/.generated/use-form-action");
  return mod.useFormAction as Mock;
};

describe("LoginForm", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    pushMock.mockReset();
  });

  it("renders email and password fields", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(createMockUseFormAction());

    // Act
    render(<LoginForm />);

    // Assert
    expect(screen.getByLabelText("Email")).toHaveAttribute("type", "email");
    expect(screen.getByLabelText("Password")).toHaveAttribute(
      "type",
      "password",
    );
  });

  it("renders an enabled submit button by default", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(createMockUseFormAction());

    // Act
    render(<LoginForm />);

    // Assert
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
  });

  it("shows an error message when action state fails", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(
      createMockUseFormAction({
        state: {
          status: false,
          message: "Invalid credentials",
        },
      }),
    );

    // Act
    render(<LoginForm />);

    // Assert
    expect(screen.getByRole("alert")).toHaveTextContent("Invalid credentials");
  });

  it("redirects to dashboard on success", async () => {
    // Setup
    const mock = await getUseFormActionMock();
    mock.mockReturnValue(
      createMockUseFormAction({
        state: {
          status: true,
          data: {
            id: "user_1",
            name: "Admin User",
            email: "admin@example.com",
          },
        },
      }),
    );

    // Act
    render(<LoginForm />);

    // Assert
    expect(pushMock).toHaveBeenCalledWith("/dashboard");
  });
});
