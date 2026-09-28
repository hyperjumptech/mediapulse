import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./api-keys-section", () => ({
  ApiKeysSection: () => <div data-testid="api-keys-section" />,
}));

vi.mock("./create-api-key-modal", () => ({
  CreateApiKeyModal: ({ trigger }: { trigger: React.ReactNode }) => (
    <div data-testid="create-api-key-modal">{trigger}</div>
  ),
}));

import ApiKeysPage from "./page";

describe("ApiKeysPage", () => {
  it("puts the create key trigger in the page header", () => {
    // Act
    render(<ApiKeysPage />);

    // Assert
    const headerActions = document.querySelector(
      '[data-slot="page-header-actions"]',
    );

    expect(
      screen.getByRole("heading", { name: "API keys" }),
    ).toBeInTheDocument();
    expect(headerActions).toContainElement(
      screen.getByRole("button", { name: "Create API key" }),
    );
    expect(screen.getByTestId("api-keys-section")).toBeInTheDocument();
  });
});
