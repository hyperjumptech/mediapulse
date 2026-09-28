import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const loadHermesAdminsForPageMock = vi.fn();
const requireDashboardAdminMock = vi.fn();

vi.mock("@/lib/require-dashboard-admin", () => ({
  requireDashboardAdmin: () => requireDashboardAdminMock(),
}));

vi.mock("@/lib/hermes-admins-page", () => ({
  loadHermesAdminsForPage: () => loadHermesAdminsForPageMock(),
}));

vi.mock("./admin-row-actions", () => ({
  AdminRowActions: ({
    admin,
    currentUserId,
  }: {
    admin: { id: string };
    currentUserId: string;
  }) => (
    <div
      data-testid={`admin-row-actions-${admin.id}`}
      data-current-user-id={currentUserId}
    />
  ),
}));

import { AdminsSection } from "./admins-section";

const currentUser = {
  id: "user-1",
  name: "Ada",
  email: "ada@example.com",
  credentialVersion: 0,
};

describe("AdminsSection", () => {
  afterEach(() => {
    loadHermesAdminsForPageMock.mockReset();
    requireDashboardAdminMock.mockReset();
  });

  it("renders each admin with status and the current user id", async () => {
    // Setup
    loadHermesAdminsForPageMock.mockResolvedValue([
      {
        id: "user-1",
        name: "Ada",
        email: "ada@example.com",
        isActive: true,
        createdAt: new Date("2026-01-02T00:00:00.000Z"),
      },
      {
        id: "user-2",
        name: "Grace",
        email: "grace@example.com",
        isActive: false,
        createdAt: new Date("2026-01-03T00:00:00.000Z"),
      },
    ]);
    requireDashboardAdminMock.mockResolvedValue(currentUser);

    // Act
    render(await AdminsSection());

    // Assert
    expect(screen.getByText("ada@example.com")).toBeInTheDocument();
    expect(screen.getByText("grace@example.com")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Disabled")).toBeInTheDocument();
    expect(screen.getByTestId("admin-row-actions-user-2")).toHaveAttribute(
      "data-current-user-id",
      "user-1",
    );
  });

  it("renders the empty state when there are no admins", async () => {
    // Setup
    loadHermesAdminsForPageMock.mockResolvedValue([]);
    requireDashboardAdminMock.mockResolvedValue(currentUser);

    // Act
    render(await AdminsSection());

    // Assert
    expect(
      screen.getByText(
        "No admins yet. Use the CLI or “Add admin” to create one.",
      ),
    ).toBeInTheDocument();
  });
});
