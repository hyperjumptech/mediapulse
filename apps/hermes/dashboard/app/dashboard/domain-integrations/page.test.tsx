import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./domain-integrations-section", () => ({
  DomainIntegrationsSection: () => (
    <div data-testid="domain-integrations-section" />
  ),
}));

import DomainIntegrationsPage from "./page";

describe("DomainIntegrationsPage", () => {
  it("puts the new integration action in the page header", () => {
    // Act
    render(<DomainIntegrationsPage />);

    // Assert
    const headerActions = document.querySelector(
      '[data-slot="page-header-actions"]',
    );
    const newIntegrationLink = screen.getByRole("link", {
      name: "New integration",
    });

    expect(
      screen.getByRole("heading", { name: "Domain integrations" }),
    ).toBeInTheDocument();
    expect(headerActions).toContainElement(newIntegrationLink);
    expect(newIntegrationLink).toHaveAttribute(
      "href",
      "/dashboard/domain-integrations/create",
    );
    expect(
      screen.getByTestId("domain-integrations-section"),
    ).toBeInTheDocument();
  });
});
