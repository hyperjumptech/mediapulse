import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AuthFooterLink, AuthPageShell } from "./auth-page-shell";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    className,
  }: React.PropsWithChildren<{ href: string; className?: string }>) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

describe("AuthPageShell", () => {
  it("renders the brand, heading, description and content", () => {
    // Act
    render(
      <AuthPageShell title="Welcome back" description="Log in to continue.">
        <p>Form</p>
      </AuthPageShell>,
    );

    // Assert
    expect(screen.getByText("Hermes")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: "Welcome back" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Log in to continue.")).toBeInTheDocument();
    expect(screen.getByText("Form")).toBeInTheDocument();
  });

  it("renders the footer when provided", () => {
    // Act
    render(
      <AuthPageShell
        title="Welcome back"
        description="Log in."
        footer="Tagline"
      >
        <p>Form</p>
      </AuthPageShell>,
    );

    // Assert
    expect(screen.getByText("Tagline")).toBeInTheDocument();
  });

  it("omits the footer when none is provided", () => {
    // Act
    const { container } = render(
      <AuthPageShell title="Welcome back" description="Log in.">
        <p>Form</p>
      </AuthPageShell>,
    );

    // Assert
    expect(container.querySelector(".text-xs.text-balance")).toBeNull();
  });
});

describe("AuthFooterLink", () => {
  it("renders a subtle link to the target page", () => {
    // Act
    render(<AuthFooterLink href="/login">Back to login</AuthFooterLink>);

    // Assert
    expect(screen.getByRole("link", { name: "Back to login" })).toHaveAttribute(
      "href",
      "/login",
    );
  });
});
