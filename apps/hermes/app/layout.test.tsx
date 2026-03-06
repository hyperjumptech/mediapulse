import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/font/google", () => ({
  Geist: () => ({
    variable: "--font-sans",
  }),
  Geist_Mono: () => ({
    variable: "--font-mono",
  }),
}));

vi.mock("sonner", () => ({
  Toaster: () => <div data-testid="toaster">Toaster</div>,
}));

vi.mock("@/components/providers", () => ({
  Providers: ({ children }: React.PropsWithChildren) => (
    <div data-testid="providers">{children}</div>
  ),
}));

vi.mock("@workspace/ui/lib/utils", () => ({
  cn: (...classes: (string | undefined)[]) => classes.filter(Boolean).join(" "),
}));

import RootLayout from "./layout";

describe("RootLayout", () => {
  it("renders children content", () => {
    // Act
    render(
      <RootLayout>
        <div data-testid="child-content">Test Content</div>
      </RootLayout>,
    );

    // Assert
    expect(screen.getByTestId("child-content")).toBeInTheDocument();
    expect(screen.getByText("Test Content")).toBeInTheDocument();
  });

  it("wraps children with Providers", () => {
    // Act
    render(
      <RootLayout>
        <div>Content</div>
      </RootLayout>,
    );

    // Assert
    expect(screen.getByTestId("providers")).toBeInTheDocument();
  });

  it("renders Toaster component", () => {
    // Act
    render(
      <RootLayout>
        <div>Content</div>
      </RootLayout>,
    );

    // Assert
    expect(screen.getByTestId("toaster")).toBeInTheDocument();
  });

  it("renders html element with lang attribute", () => {
    // Act
    render(
      <RootLayout>
        <div>Content</div>
      </RootLayout>,
    );

    // Assert
    const htmlElement = document.querySelector("html");
    expect(htmlElement).toHaveAttribute("lang", "en");
  });

  it("renders body with font classes", () => {
    // Act
    render(
      <RootLayout>
        <div>Content</div>
      </RootLayout>,
    );

    // Assert
    const bodyElement = document.querySelector("body");
    expect(bodyElement?.className).toContain("font-sans");
    expect(bodyElement?.className).toContain("antialiased");
  });
});
