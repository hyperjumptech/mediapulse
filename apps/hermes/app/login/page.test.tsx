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

  it("centers the login form on the page", () => {
    // Act
    const { container } = render(<Page />);

    // Assert
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass("flex");
    expect(wrapper).toHaveClass("min-h-svh");
    expect(wrapper).toHaveClass("items-center");
    expect(wrapper).toHaveClass("justify-center");
  });
});
