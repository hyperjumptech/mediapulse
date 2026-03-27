import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NavUser, getInitials } from "./nav-user";

vi.mock("@/app/dashboard/logout-form", () => ({
  LogoutForm: ({ className }: { className?: string }) => (
    <button data-testid="logout-form-default" className={className}>
      Sign out
    </button>
  ),
}));

vi.mock("@workspace/ui/components/dropdown-menu", () => ({
  DropdownMenu: ({ children }: React.PropsWithChildren) => (
    <div data-testid="dropdown-menu">{children}</div>
  ),
  DropdownMenuTrigger: ({ children }: React.PropsWithChildren) => (
    <div data-testid="dropdown-trigger">{children}</div>
  ),
  DropdownMenuContent: ({ children }: React.PropsWithChildren) => (
    <div data-testid="dropdown-content">{children}</div>
  ),
  DropdownMenuLabel: ({ children }: React.PropsWithChildren) => (
    <div data-testid="dropdown-label">{children}</div>
  ),
  DropdownMenuSeparator: () => <hr data-testid="dropdown-separator" />,
  DropdownMenuItem: ({ children }: React.PropsWithChildren) => (
    <div data-testid="dropdown-item">{children}</div>
  ),
}));

vi.mock("@workspace/ui/components/sidebar", () => ({
  SidebarMenu: ({ children }: React.PropsWithChildren) => (
    <nav data-testid="sidebar-menu">{children}</nav>
  ),
  SidebarMenuItem: ({ children }: React.PropsWithChildren) => (
    <div data-testid="sidebar-menu-item">{children}</div>
  ),
  SidebarMenuButton: ({
    children,
  }: React.PropsWithChildren<{
    asChild?: boolean;
    size?: string;
    className?: string;
  }>) => <button data-testid="sidebar-menu-button">{children}</button>,
}));

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

describe("NavUser", () => {
  const user = { name: "John Doe", email: "john@example.com" };

  const FakeLogoutForm = () => (
    <button data-testid="logout-form">Sign out</button>
  );

  it("renders the user initials in the trigger", () => {
    render(
      <NavUser user={user} LogoutFormComponent={FakeLogoutForm as never} />,
    );

    const initials = screen.getAllByText("JD");
    expect(initials.length).toBeGreaterThanOrEqual(1);
  });

  it("renders the user name and email in the trigger", () => {
    render(
      <NavUser user={user} LogoutFormComponent={FakeLogoutForm as never} />,
    );

    expect(screen.getAllByText("John Doe").length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText("john@example.com").length,
    ).toBeGreaterThanOrEqual(1);
  });

  it("renders the logout form inside the dropdown content", () => {
    render(
      <NavUser user={user} LogoutFormComponent={FakeLogoutForm as never} />,
    );

    expect(screen.getByTestId("logout-form")).toBeInTheDocument();
  });

  it("renders the chevrons icon button", () => {
    render(
      <NavUser user={user} LogoutFormComponent={FakeLogoutForm as never} />,
    );

    expect(screen.getByTestId("sidebar-menu-button")).toBeInTheDocument();
  });
});
