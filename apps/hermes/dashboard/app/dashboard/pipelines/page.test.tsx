import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./pipelines-section", () => ({
  PipelinesSection: () => <div data-testid="pipelines-section" />,
}));

import PipelinesPage from "./page";

describe("PipelinesPage", () => {
  it("renders the section and leaves the new pipeline action to the site header", () => {
    // Act
    render(<PipelinesPage />);

    // Assert
    expect(
      screen.queryByRole("button", { name: "New pipeline" }),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("pipelines-section")).toBeInTheDocument();
  });
});
