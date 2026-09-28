import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./admins-section", () => ({
  AdminsSection: () => <div data-testid="admins-section" />,
}));

vi.mock("./add-admin-modal", () => ({
  AddAdminModal: (props: Record<string, unknown>) => (
    <div
      data-testid="add-admin-modal"
      data-prop-names={Object.keys(props).join(",")}
    />
  ),
}));

import AdminsPage from "./page";

describe("AdminsPage", () => {
  it("mounts one URL-driven add admin modal next to the section", () => {
    // Act
    render(<AdminsPage />);

    // Assert
    expect(screen.getByTestId("add-admin-modal")).toHaveAttribute(
      "data-prop-names",
      "",
    );
    expect(screen.getByTestId("admins-section")).toBeInTheDocument();
    expect(
      document.querySelector('[data-slot="page-header-actions"]'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Add admin" }),
    ).not.toBeInTheDocument();
  });
});
