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
  it("renders the section and leaves the new integration link to the site header", () => {
    // Act
    render(<DomainIntegrationsPage />);

    // Assert
    expect(
      screen.queryByRole("link", { name: "New integration" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByTestId("domain-integrations-section"),
    ).toBeInTheDocument();
  });
});
