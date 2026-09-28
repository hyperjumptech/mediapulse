import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const requireDashboardAdminMock = vi.fn();

vi.mock("@/lib/require-dashboard-admin", () => ({
  requireDashboardAdmin: () => requireDashboardAdminMock(),
}));

import DashboardPage from "./page";

const admin = {
  id: "u1",
  name: "U",
  email: "u@example.com",
  credentialVersion: 0,
};

describe("DashboardPage", () => {
  afterEach(() => {
    requireDashboardAdminMock.mockReset();
  });

  it("renders dashboard heading when authenticated", async () => {
    // Setup
    requireDashboardAdminMock.mockResolvedValue(admin);

    // Act
    render(await DashboardPage());

    // Assert
    expect(
      screen.getByRole("heading", { name: "Dashboard", level: 1 }),
    ).toBeInTheDocument();
  });

  it("renders description text when authenticated", async () => {
    // Setup
    requireDashboardAdminMock.mockResolvedValue(admin);

    // Act
    render(await DashboardPage());

    // Assert
    expect(
      screen.getByText("Use the sidebar to manage pipelines and agents."),
    ).toBeInTheDocument();
  });

  it("applies correct styling to heading", async () => {
    // Setup
    requireDashboardAdminMock.mockResolvedValue(admin);

    // Act
    render(await DashboardPage());

    // Assert
    const heading = screen.getByRole("heading", { name: "Dashboard" });

    expect(heading).toHaveClass("text-2xl");
    expect(heading).toHaveClass("font-semibold");
  });

  it("does not render when the caller is not an active admin", async () => {
    // Setup
    requireDashboardAdminMock.mockRejectedValue(new Error("NEXT_REDIRECT"));

    // Act
    const pending = DashboardPage();

    // Assert
    await expect(pending).rejects.toThrow("NEXT_REDIRECT");
  });
});
