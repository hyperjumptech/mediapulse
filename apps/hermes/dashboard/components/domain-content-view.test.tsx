import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DomainContentView } from "./domain-content-view";

describe("DomainContentView", () => {
  it("renders plain text in a wrapping block that fits a phone", () => {
    render(
      <DomainContentView
        kind="text"
        title="Notes"
        body="https://example.com/a/very/long/path/that/never/breaks"
      />,
    );

    const body = screen.getByText(
      "https://example.com/a/very/long/path/that/never/breaks",
    );

    expect(screen.getByRole("heading", { name: "Notes" })).toBeInTheDocument();
    expect(body.tagName).toBe("PRE");
    expect(body).toHaveClass("whitespace-pre-wrap", "break-words", "p-4");
  });

  it("renders html in a sandboxed iframe capped to the viewport height", () => {
    render(<DomainContentView kind="html" title="Preview" body="<p>hi</p>" />);

    const iframe = screen.getByTitle("Preview");

    expect(iframe).toHaveAttribute("sandbox", "allow-popups");
    expect(iframe).toHaveAttribute("srcdoc", "<p>hi</p>");
    expect(iframe).toHaveClass("h-[min(480px,70vh)]", "w-full");
    expect(iframe).not.toHaveClass("min-h-[480px]");
  });

  it("falls back to a generic iframe title without a title", () => {
    render(<DomainContentView kind="html" body="<p>hi</p>" />);

    expect(screen.getByTitle("Domain content")).toBeInTheDocument();
  });

  it("renders markdown headings, lists and paragraphs that wrap long words", () => {
    const { container } = render(
      <DomainContentView
        kind="markdown"
        body={
          "# Title\n\n## Section\n\n### Detail\n\n- one\n- two\n\n1. first\n\nA paragraph."
        }
      />,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Title" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Section" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 3, name: "Detail" }),
    ).toBeInTheDocument();
    expect(screen.getByText("one").closest("ul")).toHaveClass("list-disc");
    expect(screen.getByText("first").closest("ol")).toHaveClass("list-decimal");
    expect(screen.getByText("A paragraph.")).toBeInTheDocument();
    expect(container.querySelector(".prose")).toHaveClass("break-words");
  });
});
