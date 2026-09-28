import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@workspace/ui/components/tooltip";

import { PipelineStatusBadge } from "./pipeline-status-badge";

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const renderWithTooltips = (ui: React.ReactElement) =>
  render(<TooltipProvider>{ui}</TooltipProvider>);

describe("PipelineStatusBadge", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([
    ["enabled", "Enabled", "success"],
    ["disabled", "Disabled", "muted"],
    ["incomplete", "Incomplete", "warning"],
  ] as const)("renders %s as %s with the %s tone", (status, label, tone) => {
    // Act
    renderWithTooltips(<PipelineStatusBadge status={status} />);

    // Assert
    expect(screen.getByText(label)).toHaveAttribute("data-tone", tone);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("reveals validation warnings in a tooltip for incomplete pipelines", async () => {
    // Setup
    renderWithTooltips(
      <PipelineStatusBadge
        status="incomplete"
        warnings={["Step 1: missing input", "Step 2: missing config"]}
      />,
    );
    const trigger = screen.getByRole("button", { name: "Incomplete" });

    // Act
    await act(async () => {
      fireEvent.focus(trigger);
    });

    // Assert
    const tooltip = screen.getByRole("tooltip");

    expect(tooltip).toHaveTextContent("Step 1: missing input");
    expect(tooltip).toHaveTextContent("Step 2: missing config");
  });

  it("ignores warnings unless the pipeline is incomplete", () => {
    // Act
    renderWithTooltips(
      <PipelineStatusBadge status="disabled" warnings={["Stale warning"]} />,
    );

    // Assert
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText("Disabled")).toBeInTheDocument();
  });
});
