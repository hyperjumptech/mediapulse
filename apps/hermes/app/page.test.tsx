import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Page from "./page";

describe("Page (Root)", () => {
  it("renders the Hermes heading", () => {
    // Act
    render(<Page />);

    // Assert
    expect(
      screen.getByRole("heading", { name: "Hermes", level: 1 }),
    ).toBeInTheDocument();
  });

  it("renders centered container", () => {
    // Act
    const { container } = render(<Page />);

    // Assert
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass("flex");
    expect(wrapper).toHaveClass("items-center");
    expect(wrapper).toHaveClass("justify-center");
    expect(wrapper).toHaveClass("min-h-svh");
  });

  it("renders heading with correct styling", () => {
    // Act
    render(<Page />);

    // Assert
    const heading = screen.getByRole("heading", { name: "Hermes" });
    expect(heading).toHaveClass("text-2xl");
    expect(heading).toHaveClass("font-bold");
  });
});
