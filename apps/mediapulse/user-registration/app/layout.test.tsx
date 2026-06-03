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

import RootLayout, { metadata } from "./layout";

describe("metadata", () => {
  const expectedTitle = "MediaPulse - Business newsletter";
  const expectedDescription =
    "Subscribe to MediaPulse and get the latest business and industry news for your chosen ticker delivered straight to your inbox.";

  it("has the business-framed title", () => {
    expect(metadata.title).toBe(expectedTitle);
  });

  it("has the business-framed description", () => {
    expect(metadata.description).toBe(expectedDescription);
  });

  it("has matching openGraph title and description", () => {
    expect(metadata.openGraph?.title).toBe(expectedTitle);
    expect(metadata.openGraph?.description).toBe(expectedDescription);
  });

  it("has matching twitter title and description", () => {
    expect(
      (metadata.twitter as { title?: string; description?: string })?.title,
    ).toBe(expectedTitle);
    expect(
      (metadata.twitter as { title?: string; description?: string })
        ?.description,
    ).toBe(expectedDescription);
  });
});

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
