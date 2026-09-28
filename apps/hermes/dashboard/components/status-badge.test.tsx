import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StatusBadge, statusBadgeVariant } from "./status-badge";

describe("statusBadgeVariant", () => {
  it.each([
    ["running", "info"],
    ["succeeded", "success"],
    ["completed", "success"],
    ["partial", "warning"],
    ["failed", "destructive"],
    ["pending", "muted"],
    ["cancelled", "muted"],
    ["Enabled", "success"],
    ["something-else", "outline"],
  ])("maps %s to %s", (status, variant) => {
    expect(statusBadgeVariant(status)).toBe(variant);
  });
});

describe("StatusBadge", () => {
  it("renders the humanized status with its variant", () => {
    // Act
    render(<StatusBadge status="needs_review" />);

    // Assert
    const badge = screen.getByText("needs review");

    expect(badge).toHaveAttribute("data-variant", "outline");
  });

  it("prefers an explicit label", () => {
    // Act
    render(<StatusBadge status="failed" label="Failed twice" />);

    // Assert
    expect(screen.getByText("Failed twice")).toHaveAttribute(
      "data-variant",
      "destructive",
    );
  });
});
