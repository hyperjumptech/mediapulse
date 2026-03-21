import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi, type Mock } from "vitest";
import { LogoutForm } from "./logout-form";

const replaceMock = vi.fn();

/**
 * Creates a predictable form wrapper for `useFormAction` tests.
 *
 * @returns A simple form component used in tests.
 */
const createMockFormWithAction = () => {
  const FormWithAction = ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => (
    <form data-testid="logout-form" className={className}>
      {children}
    </form>
  );
  FormWithAction.displayName = "FormWithAction";
  return FormWithAction;
};

/**
 * Creates a default shape that mirrors `useFormAction` output.
 *
 * @param overrides - Optional state overrides for a specific test.
 * @returns A mocked `useFormAction` return value.
 */
const createMockUseFormAction = (overrides?: {
  state?: {
    status: boolean;
    message?: string;
    data?: { redirectTo: "/login" };
  } | null;
  pending?: boolean;
}) => ({
  FormWithAction: createMockFormWithAction(),
  state: overrides?.state ?? null,
  pending: overrides?.pending ?? false,
});

vi.mock("../logout/action/.generated/use-form-action", () => ({
  useFormAction: vi.fn(() => createMockUseFormAction()),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: replaceMock,
  }),
}));

/**
 * Returns the mocked `useFormAction` function.
 *
 * @returns The mocked useFormAction function.
 */
const getUseFormActionMock = async () => {
  const mod = await import("../logout/action/.generated/use-form-action");
  return mod.useFormAction as Mock;
};

describe("LogoutForm", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    replaceMock.mockReset();
  });

  it("renders an enabled sign out button by default", async () => {
    // Setup
    const useFormActionMock = await getUseFormActionMock();
    useFormActionMock.mockReturnValue(createMockUseFormAction());

    // Act
    render(<LogoutForm />);

    // Assert
    expect(screen.getByRole("button", { name: "Sign out" })).toBeEnabled();
  });

  it("shows a pending button label while submitting", async () => {
    // Setup
    const useFormActionMock = await getUseFormActionMock();
    useFormActionMock.mockReturnValue(
      createMockUseFormAction({
        pending: true,
      }),
    );

    // Act
    render(<LogoutForm />);

    // Assert
    expect(
      screen.getByRole("button", { name: "Signing out..." }),
    ).toBeDisabled();
  });

  it("shows an error message when logout fails", async () => {
    // Setup
    const useFormActionMock = await getUseFormActionMock();
    useFormActionMock.mockReturnValue(
      createMockUseFormAction({
        state: {
          status: false,
          message: "Unable to sign out",
        },
      }),
    );

    // Act
    render(<LogoutForm />);

    // Assert
    expect(screen.getByRole("alert")).toHaveTextContent("Unable to sign out");
  });

  it("redirects to login on successful logout", async () => {
    // Setup
    const useFormActionMock = await getUseFormActionMock();
    useFormActionMock.mockReturnValue(
      createMockUseFormAction({
        state: {
          status: true,
          data: {
            redirectTo: "/login",
          },
        },
      }),
    );

    // Act
    render(<LogoutForm />);

    // Assert
    expect(replaceMock).toHaveBeenCalledWith("/login");
  });
});
