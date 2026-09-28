import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import Page from "./page";

vi.mock("./reset-password-form", () => ({
  ResetPasswordForm: ({ token }: { token: string }) => (
    <div data-testid="reset-password-form" data-token={token} />
  ),
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: React.PropsWithChildren<{ href: string }>) => (
    <a href={href}>{children}</a>
  ),
}));

describe("ResetPasswordPage", () => {
  it("renders the reset form for a link with a token", async () => {
    // Act
    render(await Page({ searchParams: Promise.resolve({ token: " abc " }) }));

    // Assert
    expect(
      screen.getByRole("heading", { level: 1, name: "Set a new password" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("reset-password-form")).toHaveAttribute(
      "data-token",
      "abc",
    );
  });

  it("explains an invalid link and offers a new one when the token is missing", async () => {
    // Act
    render(await Page({ searchParams: Promise.resolve({}) }));

    // Assert
    expect(
      screen.getByRole("heading", { level: 1, name: "Invalid link" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Forgot password" }),
    ).toHaveAttribute("href", "/login/forgot-password");
  });
});
