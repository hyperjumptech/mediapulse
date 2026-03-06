import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-themes", () => ({
  ThemeProvider: ({ children }: React.PropsWithChildren) => (
    <div data-testid="theme-provider">{children}</div>
  ),
}));

import { Providers } from "./providers";

describe("Providers", () => {
  it("renders children correctly", () => {
    // Act
    render(
      <Providers>
        <div data-testid="child">Test Content</div>
      </Providers>,
    );

    // Assert
    expect(screen.getByTestId("child")).toBeInTheDocument();
    expect(screen.getByText("Test Content")).toBeInTheDocument();
  });

  it("wraps children with theme provider", () => {
    // Act
    render(
      <Providers>
        <div data-testid="themed-content">Themed</div>
      </Providers>,
    );

    // Assert
    expect(screen.getByTestId("theme-provider")).toBeInTheDocument();
    expect(screen.getByTestId("themed-content")).toBeInTheDocument();
  });

  it("renders multiple children", () => {
    // Act
    render(
      <Providers>
        <div data-testid="first">First</div>
        <div data-testid="second">Second</div>
      </Providers>,
    );

    // Assert
    expect(screen.getByTestId("first")).toBeInTheDocument();
    expect(screen.getByTestId("second")).toBeInTheDocument();
  });
});
