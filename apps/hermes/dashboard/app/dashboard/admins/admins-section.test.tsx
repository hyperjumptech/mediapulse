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

vi.mock("@/lib/data-table/read-column-visibility", () => ({
  readColumnVisibility: async () => ({ created: false }),
}));

vi.mock("./admins-table", () => ({
  AdminsTable: ({
    admins,
    currentUserId,
    initialColumnVisibility,
  }: {
    admins: Array<{ id: string }>;
    currentUserId: string;
    initialColumnVisibility: Record<string, boolean>;
  }) => (
    <div
      data-testid="admins-table"
      data-count={admins.length}
      data-current-user-id={currentUserId}
      data-visibility={JSON.stringify(initialColumnVisibility)}
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

  it("hands the table its admins, the current user and saved column choices", async () => {
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

    render(await AdminsSection());

    const table = screen.getByTestId("admins-table");

    expect(table).toHaveAttribute("data-count", "2");
    expect(table).toHaveAttribute("data-current-user-id", "user-1");
    expect(table).toHaveAttribute(
      "data-visibility",
      JSON.stringify({ created: false }),
    );
  });
});
