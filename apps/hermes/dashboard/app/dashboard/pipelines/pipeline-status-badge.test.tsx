import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PipelineStatusBadge } from "./pipeline-status-badge";

describe("PipelineStatusBadge", () => {
  it("renders Incomplete with destructive styling label", () => {
    render(<PipelineStatusBadge status="incomplete" />);
    expect(screen.getByText("Incomplete")).toBeInTheDocument();
  });

  it("renders Disabled", () => {
    render(<PipelineStatusBadge status="disabled" />);
    expect(screen.getByText("Disabled")).toBeInTheDocument();
  });

  it("renders Enabled", () => {
    render(<PipelineStatusBadge status="enabled" />);
    expect(screen.getByText("Enabled")).toBeInTheDocument();
  });
});
