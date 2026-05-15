import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  DEFAULT_HYPERJUMP_SITE_URL,
  HyperjumpProductAttribution,
} from "./hyperjump-product-attribution";

describe("HyperjumpProductAttribution", () => {
  it("renders Mediapulse copy with a Hyperjump link to the default URL", () => {
    // Act
    render(<HyperjumpProductAttribution />);

    // Assert
    expect(screen.getByText(/Mediapulse is a product by/i)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /^Hyperjump$/i });
    expect(link).toHaveAttribute("href", DEFAULT_HYPERJUMP_SITE_URL);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("uses the injected company site URL for the link href", () => {
    // Act
    render(
      <HyperjumpProductAttribution companySiteUrl="https://example.test/hj" />,
    );

    // Assert
    expect(screen.getByRole("link", { name: /^Hyperjump$/i })).toHaveAttribute(
      "href",
      "https://example.test/hj",
    );
  });
});
