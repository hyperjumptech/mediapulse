import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PageHeader } from "./page-header";

describe("PageHeader", () => {
  it("renders title as h1", () => {
    // Act
    render(
      <PageHeader
        title="Test Page"
        description="A short description for the page."
      />,
    );

    // Assert
    expect(
      screen.getByRole("heading", { name: "Test Page", level: 1 }),
    ).toBeInTheDocument();
  });

  it("renders description text", () => {
    // Act
    render(
      <PageHeader
        title="Test Page"
        description="A short description for the page."
      />,
    );

    // Assert
    expect(
      screen.getByText("A short description for the page."),
    ).toBeInTheDocument();
  });

  it("applies expected heading classes", () => {
    // Act
    render(
      <PageHeader
        title="Test Page"
        description="A short description for the page."
      />,
    );

    // Assert
    const heading = screen.getByRole("heading", { name: "Test Page" });
    expect(heading).toHaveClass("text-2xl");
    expect(heading).toHaveClass("font-semibold");
  });
});
