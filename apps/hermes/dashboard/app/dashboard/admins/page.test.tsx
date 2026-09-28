import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./admins-section", () => ({
  AdminsSection: () => <div data-testid="admins-section" />,
}));

vi.mock("./add-admin-modal", () => ({
  AddAdminModal: ({ trigger }: { trigger: React.ReactNode }) => (
    <div data-testid="add-admin-modal">{trigger}</div>
  ),
}));

import AdminsPage from "./page";

describe("AdminsPage", () => {
  it("puts the add admin trigger in the page header", () => {
    // Act
    render(<AdminsPage />);

    // Assert
    const headerActions = document.querySelector(
      '[data-slot="page-header-actions"]',
    );

    expect(headerActions).toContainElement(
      screen.getByRole("button", { name: "Add admin" }),
    );
    expect(screen.getByTestId("admins-section")).toBeInTheDocument();
  });
});
