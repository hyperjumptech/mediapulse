import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./api-keys-section", () => ({
  ApiKeysSection: () => <div data-testid="api-keys-section" />,
}));

vi.mock("./create-api-key-modal", () => ({
  CreateApiKeyModal: (props: Record<string, unknown>) => (
    <div
      data-testid="create-api-key-modal"
      data-prop-names={Object.keys(props).join(",")}
    />
  ),
}));

import ApiKeysPage from "./page";

describe("ApiKeysPage", () => {
  it("mounts one URL-driven create key modal next to the section", () => {
    // Act
    render(<ApiKeysPage />);

    // Assert
    expect(screen.getByTestId("create-api-key-modal")).toHaveAttribute(
      "data-prop-names",
      "",
    );
    expect(screen.getByTestId("api-keys-section")).toBeInTheDocument();
    expect(
      document.querySelector('[data-slot="page-header-actions"]'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Create API key" }),
    ).not.toBeInTheDocument();
  });
});
