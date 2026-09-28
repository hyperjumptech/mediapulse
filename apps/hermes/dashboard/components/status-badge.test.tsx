import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StatusBadge, statusTone } from "./status-badge";

describe("statusTone", () => {
  it.each([
    ["running", "progress"],
    ["pending", "progress"],
    ["succeeded", "success"],
    ["completed", "success"],
    ["Enabled", "success"],
    ["partial", "warning"],
    ["failed", "failed"],
    ["cancelled", "muted"],
    ["skipped", "muted"],
    ["something-else", "neutral"],
  ])("maps %s to %s", (status, tone) => {
    expect(statusTone(status)).toBe(tone);
  });
});

describe("StatusBadge", () => {
  it("renders an outline badge with the humanized status", () => {
    render(<StatusBadge status="needs_review" />);

    const badge = screen.getByText("needs review");

    expect(badge).toHaveAttribute("data-variant", "outline");
    expect(badge).toHaveAttribute("data-tone", "neutral");
  });

  it("prefers an explicit label and keeps the status tone", () => {
    render(<StatusBadge status="failed" label="Failed twice" />);

    expect(screen.getByText("Failed twice")).toHaveAttribute(
      "data-tone",
      "failed",
    );
  });
});
