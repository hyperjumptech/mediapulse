import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DetailBlockSectionHeader } from "./detail-block-section-header";

describe("DetailBlockSectionHeader", () => {
  it("renders only the label when no rule is set", () => {
    render(<DetailBlockSectionHeader label="Body" data={{}} />);
    expect(screen.getByText("Body")).toBeInTheDocument();
  });

  it("renders the badge when the rule evaluates to true", () => {
    render(
      <DetailBlockSectionHeader
        label="Delivery"
        sectionRule={{
          when: "delivered < enabled",
          badge: "warning",
          label: "partial",
        }}
        data={{ delivered: 1, enabled: 5 }}
      />,
    );
    expect(screen.getByText("partial")).toHaveAttribute("data-tone", "warning");
  });

  it("omits the badge when the rule evaluates to false", () => {
    render(
      <DetailBlockSectionHeader
        label="Delivery"
        sectionRule={{
          when: "delivered < enabled",
          badge: "warning",
          label: "partial",
        }}
        data={{ delivered: 5, enabled: 5 }}
      />,
    );
    expect(screen.queryByText("partial")).toBeNull();
  });

  it("silently ignores an invalid rule rather than throwing", () => {
    render(
      <DetailBlockSectionHeader
        label="Delivery"
        sectionRule={{
          when: "this && that",
          badge: "warning",
          label: "partial",
        }}
        data={{}}
      />,
    );
    expect(screen.queryByText("partial")).toBeNull();
    expect(screen.getByText("Delivery")).toBeInTheDocument();
  });

  it("uses the dashboard heading scale and wraps its badge on narrow screens", () => {
    render(
      <DetailBlockSectionHeader
        label="Delivery"
        sectionRule={{
          when: "delivered < enabled",
          badge: "warning",
          label: "partial",
        }}
        data={{ delivered: 1, enabled: 5 }}
      />,
    );

    const heading = screen.getByRole("heading", { level: 2, name: "Delivery" });

    expect(heading).toHaveClass("text-base", "font-semibold");
    expect(heading.parentElement).toHaveClass("flex-wrap", "gap-2");
  });

  it("renders nothing without a label or a matching rule", () => {
    const { container } = render(<DetailBlockSectionHeader data={{}} />);

    expect(container).toBeEmptyDOMElement();
  });
});
