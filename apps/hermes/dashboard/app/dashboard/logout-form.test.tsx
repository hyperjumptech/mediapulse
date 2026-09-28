import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi, type Mock } from "vitest";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";

import { LogoutForm, LogoutMenuItem } from "./logout-form";

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

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const renderLogoutMenuItem = () =>
  render(
    <DropdownMenu open>
      <DropdownMenuTrigger>Account</DropdownMenuTrigger>
      <DropdownMenuContent>
        <LogoutMenuItem />
      </DropdownMenuContent>
    </DropdownMenu>,
  );

describe("LogoutMenuItem", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    replaceMock.mockReset();
  });

  it("renders a keyboard reachable log out menu item", async () => {
    // Setup
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    const useFormActionMock = await getUseFormActionMock();
    useFormActionMock.mockReturnValue(createMockUseFormAction());

    // Act
    renderLogoutMenuItem();

    // Assert
    expect(screen.getByRole("menuitem", { name: "Log out" })).toHaveAttribute(
      "type",
      "submit",
    );
  });

  it("submits the logout form on Enter and keeps the menu open", async () => {
    // Setup
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    const useFormActionMock = await getUseFormActionMock();
    useFormActionMock.mockReturnValue(createMockUseFormAction());
    renderLogoutMenuItem();
    const submitListener = vi.fn((event: Event) => event.preventDefault());
    screen
      .getByTestId("logout-form")
      .addEventListener("submit", submitListener);
    const logoutItem = screen.getByRole("menuitem", { name: "Log out" });

    // Act
    await act(async () => {
      logoutItem.focus();
      fireEvent.keyDown(logoutItem, { key: "Enter" });
    });

    // Assert
    expect(submitListener).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });

  it("shows a disabled pending item while logging out", async () => {
    // Setup
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    const useFormActionMock = await getUseFormActionMock();
    useFormActionMock.mockReturnValue(
      createMockUseFormAction({ pending: true }),
    );

    // Act
    renderLogoutMenuItem();

    // Assert
    expect(
      screen.getByRole("menuitem", { name: "Logging out…" }),
    ).toHaveAttribute("aria-disabled", "true");
  });

  it("shows the logout error inside the menu", async () => {
    // Setup
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    const useFormActionMock = await getUseFormActionMock();
    useFormActionMock.mockReturnValue(
      createMockUseFormAction({
        state: { status: false, message: "Unable to log out" },
      }),
    );

    // Act
    renderLogoutMenuItem();

    // Assert
    expect(screen.getByRole("alert")).toHaveTextContent("Unable to log out");
  });
});
