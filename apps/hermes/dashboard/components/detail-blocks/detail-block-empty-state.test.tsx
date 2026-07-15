/** @vitest-environment jsdom */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DetailBlockEmptyState } from "./detail-block-empty-state";

describe("DetailBlockEmptyState", () => {
  it("renders the message inside a centered bordered card", () => {
    render(<DetailBlockEmptyState message="No items." />);
    const node = screen.getByText("No items.");

    expect(node.className).toContain("text-center");
    expect(node.className).toContain("border");
  });
});
