import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Page from "./page";

vi.mock("./login-form", () => ({
  LoginForm: () => <div data-testid="login-form">Login Form</div>,
}));

describe("LoginPage", () => {
  it("renders the LoginForm component", () => {
    // Act
    render(<Page />);

    // Assert
    expect(screen.getByTestId("login-form")).toBeInTheDocument();
  });

  it("renders split layout with two columns on large screens", () => {
    // Act
    const { container } = render(<Page />);

    // Assert
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass("grid");
    expect(wrapper).toHaveClass("min-h-svh");
    expect(wrapper).toHaveClass("lg:grid-cols-2");
  });

  it("renders Hermes branding copy", () => {
    // Act
    render(<Page />);

    // Assert
    expect(screen.getAllByText("Hermes").length).toBeGreaterThan(0);
    expect(
      screen.getByText(/Swiftly carrying messages between worlds\./),
    ).toBeInTheDocument();
  });
});
