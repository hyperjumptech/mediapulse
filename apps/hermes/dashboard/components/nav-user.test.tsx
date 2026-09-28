import React from "react";
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DropdownMenuItem } from "@workspace/ui/components/dropdown-menu";
import { SidebarProvider } from "@workspace/ui/components/sidebar";

import { NavUser, getInitials, useThemePreference } from "./nav-user";

const useThemeMock = vi.fn();
const setThemeMock = vi.fn();

vi.mock("next-themes", () => ({
  useTheme: () => useThemeMock(),
}));

vi.mock("@/app/dashboard/logout-form", () => ({
  LogoutMenuItem: () => (
    <div data-testid="logout-menu-item-default">Log out</div>
  ),
}));

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const stubMatchMedia = () => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
};

const user = { name: "John Doe", email: "john@example.com" };

const logoutSelectMock = vi.fn();

const FakeLogoutMenuItem = () => (
  <DropdownMenuItem onSelect={logoutSelectMock}>Log out</DropdownMenuItem>
);

const renderNavUser = () =>
  render(
    <SidebarProvider>
      <NavUser user={user} LogoutMenuItemComponent={FakeLogoutMenuItem} />
    </SidebarProvider>,
  );

const openUserMenu = async () => {
  const trigger = screen.getByRole("button", { name: /John Doe/ });

  await act(async () => {
    fireEvent.keyDown(trigger, { key: "Enter" });
  });

  return screen.getByRole("menu");
};

const openThemeMenu = async (userMenu: HTMLElement) => {
  const themeTrigger = within(userMenu).getByRole("menuitem", {
    name: "Theme",
  });

  await act(async () => {
    themeTrigger.focus();
    fireEvent.keyDown(themeTrigger, { key: "ArrowRight" });
  });
};

describe("getInitials", () => {
  it("returns two uppercase initials from a full name", () => {
    expect(getInitials("John Doe", "john@example.com")).toBe("JD");
  });

  it("returns first two chars of a single-word name", () => {
    expect(getInitials("Admin", "admin@example.com")).toBe("AD");
  });

  it("falls back to email when name is empty", () => {
    expect(getInitials("", "john@example.com")).toBe("JE");
  });

  it("handles hyphenated names (hyphen is a separator)", () => {
    expect(getInitials("Mary-Jane Watson", "mj@example.com")).toBe("MJ");
  });

  it("handles name with leading/trailing spaces", () => {
    expect(getInitials("  Jane  ", "jane@example.com")).toBe("JA");
  });
});

describe("useThemePreference", () => {
  afterEach(() => {
    useThemeMock.mockReset();
    setThemeMock.mockReset();
  });

  it.each([
    [undefined, "system"],
    ["light", "light"],
    ["dark", "dark"],
    ["system", "system"],
    ["sepia", "system"],
  ])("maps theme %s to preference %s", (theme, expectedPreference) => {
    // Setup
    useThemeMock.mockReturnValue({ theme, setTheme: setThemeMock });

    // Act
    const { result } = renderHook(() => useThemePreference());

    // Assert
    expect(result.current.themePreference).toBe(expectedPreference);
  });

  it("sets a supported theme", () => {
    // Setup
    useThemeMock.mockReturnValue({ theme: "light", setTheme: setThemeMock });
    const { result } = renderHook(() => useThemePreference());

    // Act
    result.current.setThemePreference("dark");

    // Assert
    expect(setThemeMock).toHaveBeenCalledWith("dark");
  });

  it("ignores an unsupported theme", () => {
    // Setup
    useThemeMock.mockReturnValue({ theme: "light", setTheme: setThemeMock });
    const { result } = renderHook(() => useThemePreference());

    // Act
    result.current.setThemePreference("sepia");

    // Assert
    expect(setThemeMock).not.toHaveBeenCalled();
  });
});

describe("NavUser", () => {
  beforeEach(() => {
    stubMatchMedia();
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    useThemeMock.mockReturnValue({ theme: "dark", setTheme: setThemeMock });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    useThemeMock.mockReset();
    setThemeMock.mockReset();
    logoutSelectMock.mockReset();
  });

  it("shows the avatar initials, name, and email in the trigger", () => {
    // Act
    renderNavUser();

    // Assert
    const trigger = screen.getByRole("button", { name: /John Doe/ });

    expect(trigger).toHaveTextContent("JD");
    expect(trigger).toHaveTextContent("john@example.com");
  });

  it("shows the user, theme menu, and log out item when opened", async () => {
    // Setup
    renderNavUser();

    // Act
    const userMenu = await openUserMenu();

    // Assert
    expect(userMenu).toHaveTextContent("John Doe");
    expect(userMenu).toHaveTextContent("john@example.com");
    expect(
      within(userMenu).getByRole("menuitem", { name: "Theme" }),
    ).toBeInTheDocument();
    expect(
      within(userMenu).getByRole("menuitem", { name: "Log out" }),
    ).toBeInTheDocument();
  });

  it("selects the log out item from the keyboard", async () => {
    // Setup
    renderNavUser();
    const userMenu = await openUserMenu();
    const logoutItem = within(userMenu).getByRole("menuitem", {
      name: "Log out",
    });

    // Act
    await act(async () => {
      logoutItem.focus();
      fireEvent.keyDown(logoutItem, { key: "Enter" });
    });

    // Assert
    expect(logoutSelectMock).toHaveBeenCalledTimes(1);
  });

  it("checks the current theme in the theme menu", async () => {
    // Setup
    renderNavUser();
    const userMenu = await openUserMenu();

    // Act
    await openThemeMenu(userMenu);

    // Assert
    expect(screen.getByRole("menuitemradio", { name: "Dark" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(
      screen.getByRole("menuitemradio", { name: "Light" }),
    ).toHaveAttribute("aria-checked", "false");
    expect(
      screen.getByRole("menuitemradio", { name: "System" }),
    ).toHaveAttribute("aria-checked", "false");
  });

  it("switches the theme from the theme menu", async () => {
    // Setup
    renderNavUser();
    const userMenu = await openUserMenu();
    await openThemeMenu(userMenu);

    // Act
    await act(async () => {
      fireEvent.click(screen.getByRole("menuitemradio", { name: "Light" }));
    });

    // Assert
    expect(setThemeMock).toHaveBeenCalledWith("light");
  });

  it("uses the real log out menu item by default", async () => {
    // Setup
    render(
      <SidebarProvider>
        <NavUser user={user} />
      </SidebarProvider>,
    );

    // Act
    const userMenu = await openUserMenu();

    // Assert
    expect(
      within(userMenu).getByTestId("logout-menu-item-default"),
    ).toBeInTheDocument();
  });
});
