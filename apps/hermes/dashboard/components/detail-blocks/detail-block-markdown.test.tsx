/** @vitest-environment jsdom */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DetailBlockMarkdownView } from "./detail-block-markdown";

describe("DetailBlockMarkdownView", () => {
  it("renders headings, paragraphs, and lists", () => {
    render(
      <DetailBlockMarkdownView
        block={{ type: "markdown", field: "body" }}
        data={{
          body: "# Heading\n\nFirst paragraph.\n\n- one\n- two",
        }}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "Heading" }),
    ).toBeInTheDocument();
    expect(screen.getByText("First paragraph.")).toBeInTheDocument();
    expect(screen.getByText("one")).toBeInTheDocument();
    expect(screen.getByText("two")).toBeInTheDocument();
  });

  it("renders inline links opening in a new tab with rel=noopener", () => {
    render(
      <DetailBlockMarkdownView
        block={{ type: "markdown", field: "body" }}
        data={{ body: "See [docs](https://example.com/x) for details." }}
      />,
    );
    const link = screen.getByRole("link", { name: "docs" });
    expect(link).toHaveAttribute("href", "https://example.com/x");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("shows the expander only when clamping engages", () => {
    const body = "a".repeat(120);
    render(
      <DetailBlockMarkdownView
        block={{
          type: "markdown",
          field: "body",
          clampChars: 50,
          clampThreshold: 100,
        }}
        data={{ body }}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Show full" }),
    ).toBeInTheDocument();
  });

  it("does not render the expander when below the clamp threshold", () => {
    render(
      <DetailBlockMarkdownView
        block={{
          type: "markdown",
          field: "body",
          clampChars: 50,
          clampThreshold: 100,
        }}
        data={{ body: "short body" }}
      />,
    );
    expect(screen.queryByRole("button", { name: /show/i })).toBeNull();
  });
});
