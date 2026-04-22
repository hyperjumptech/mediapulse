import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Badge } from "./badge.js";

describe("Badge", () => {
  it("renders default variant", () => {
    render(<Badge>Default</Badge>);
    expect(screen.getByText("Default")).toBeInTheDocument();
  });

  it("renders secondary variant", () => {
    render(<Badge variant="secondary">Secondary</Badge>);
    const badge = screen.getByText("Secondary");
    expect(badge).toBeInTheDocument();
  });

  it("renders destructive variant", () => {
    render(<Badge variant="destructive">Destructive</Badge>);
    const badge = screen.getByText("Destructive");
    expect(badge).toBeInTheDocument();
  });

  it("renders outline variant", () => {
    render(<Badge variant="outline">Outline</Badge>);
    const badge = screen.getByText("Outline");
    expect(badge).toBeInTheDocument();
  });

  it("renders success variant", () => {
    render(<Badge variant="success">Success</Badge>);
    const badge = screen.getByText("Success");
    expect(badge).toBeInTheDocument();
  });

  it("renders warning variant", () => {
    render(<Badge variant="warning">Warning</Badge>);
    const badge = screen.getByText("Warning");
    expect(badge).toBeInTheDocument();
  });
});
