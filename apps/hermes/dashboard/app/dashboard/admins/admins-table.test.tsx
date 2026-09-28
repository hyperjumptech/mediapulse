import React from "react";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

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

import { AdminsTable } from "./admins-table";

const admins = [
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
];

const renderAdmins = (
  overrides: Partial<React.ComponentProps<typeof AdminsTable>> = {},
) =>
  render(<AdminsTable admins={admins} currentUserId="user-1" {...overrides} />);

const table = () => screen.getByRole("table");

describe("AdminsTable", () => {
  it("shows name, email, status and created columns", () => {
    renderAdmins();

    const headers = within(table())
      .getAllByRole("columnheader")
      .map((header) => header.textContent);

    expect(headers).toEqual(["Name", "Email", "Status", "Created", "Actions"]);
  });

  it("renders each admin with an active or disabled status", () => {
    renderAdmins();

    expect(within(table()).getByText("ada@example.com")).toBeInTheDocument();
    expect(within(table()).getByText("grace@example.com")).toBeInTheDocument();
    expect(within(table()).getByText("Active")).toHaveAttribute(
      "data-tone",
      "success",
    );
    expect(within(table()).getByText("Disabled")).toHaveAttribute(
      "data-tone",
      "muted",
    );
  });

  it("marks only the current user with a You badge", () => {
    renderAdmins();

    const youBadges = within(table()).getAllByText("You");
    const currentUserRow = within(table()).getByText("Ada").closest("tr");

    expect(youBadges).toHaveLength(1);
    expect(currentUserRow).toContainElement(youBadges[0] ?? null);
  });

  it("passes the current user id to the row actions", () => {
    renderAdmins();

    expect(
      within(table()).getByTestId("admin-row-actions-user-2"),
    ).toHaveAttribute("data-current-user-id", "user-1");
  });

  it("starts from the saved column visibility", () => {
    renderAdmins({ initialColumnVisibility: { created: false } });

    expect(
      within(table()).queryByRole("columnheader", { name: "Created" }),
    ).not.toBeInTheDocument();
  });

  it("renders the empty state when there are no admins", () => {
    renderAdmins({ admins: [] });

    expect(screen.getByText("No admins yet")).toBeInTheDocument();
    expect(
      screen.getByText("Use the CLI or “Add admin” to create one."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
