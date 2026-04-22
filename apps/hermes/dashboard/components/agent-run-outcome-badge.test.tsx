import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AgentRunOutcomeBadge } from "./agent-run-outcome-badge";

vi.mock("@workspace/ui/components/badge", () => ({
  Badge: ({
    variant,
    children,
  }: {
    variant?: string;
    children: React.ReactNode;
  }) => (
    <span data-testid="badge" data-variant={variant}>
      {children}
    </span>
  ),
}));

describe("AgentRunOutcomeBadge", () => {
  it("renders success badge with success variant", () => {
    // Act
    render(<AgentRunOutcomeBadge outcome="success" />);

    // Assert
    const badge = screen.getByTestId("badge");
    expect(badge).toHaveAttribute("data-variant", "success");
    expect(badge).toHaveTextContent("Success");
  });

  it("renders skipped badge with warning variant", () => {
    // Act
    render(<AgentRunOutcomeBadge outcome="skipped" />);

    // Assert
    const badge = screen.getByTestId("badge");
    expect(badge).toHaveAttribute("data-variant", "warning");
    expect(badge).toHaveTextContent("Skipped");
  });

  it("renders failed badge with destructive variant", () => {
    // Act
    render(<AgentRunOutcomeBadge outcome="failed" />);

    // Assert
    const badge = screen.getByTestId("badge");
    expect(badge).toHaveAttribute("data-variant", "destructive");
    expect(badge).toHaveTextContent("Failed");
  });
});
