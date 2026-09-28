import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./pipelines-section", () => ({
  PipelinesSection: () => <div data-testid="pipelines-section" />,
}));

import PipelinesPage from "./page";

describe("PipelinesPage", () => {
  it("renders the page header with the new pipeline action and the section", () => {
    // Act
    render(<PipelinesPage />);

    // Assert
    expect(
      screen.getByRole("button", { name: "New pipeline" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("pipelines-section")).toBeInTheDocument();
  });
});
