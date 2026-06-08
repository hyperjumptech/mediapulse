import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { InsightsPayload } from "@workspace/agent-data-api-contract";

vi.mock("@/components/insights/widget-renderer", () => ({
  WidgetRenderer: ({ widget }: { widget: { kind: string } }) => (
    <div data-testid="widget-renderer" data-kind={widget.kind}>
      Widget
    </div>
  ),
}));

vi.mock("./window-switcher", () => ({
  WindowSwitcher: ({ current }: { current: string }) => (
    <div data-testid="window-switcher" data-current={current}>
      Window switcher
    </div>
  ),
}));

import { InsightsTab } from "./insights-tab";

const createMockPayload = (
  overrides: Partial<InsightsPayload> = {},
): InsightsPayload => ({
  agentId: "test-agent",
  window: "7d",
  generatedAt: "2024-06-01T00:00:00.000Z",
  kpis: [],
  alerts: [],
  sections: [],
  ...overrides,
});

describe("InsightsTab", () => {
  it("shows All healthy banner when no alerts", () => {
    const payload = createMockPayload({ alerts: [] });

    render(<InsightsTab payload={payload} agentId="test-agent" window="7d" />);

    expect(screen.getByText("All healthy")).toBeInTheDocument();
  });

  it("shows alert messages when alerts exist", () => {
    const payload = createMockPayload({
      alerts: [
        {
          id: "a1",
          severity: "warning",
          message: "High error rate detected",
        },
        {
          id: "a2",
          severity: "critical",
          message: "Service is down",
        },
      ],
    });

    render(<InsightsTab payload={payload} agentId="test-agent" window="7d" />);

    expect(screen.getByText("High error rate detected")).toBeInTheDocument();
    expect(screen.getByText("Service is down")).toBeInTheDocument();
    expect(screen.queryByText("All healthy")).not.toBeInTheDocument();
  });

  it("renders KPI labels and values", () => {
    const payload = createMockPayload({
      kpis: [
        { id: "k1", label: "Requests", value: 1234, unit: "req" },
        { id: "k2", label: "Latency", value: 42, unit: "ms", delta: -5 },
      ],
    });

    render(<InsightsTab payload={payload} agentId="test-agent" window="7d" />);

    expect(screen.getByText("Requests")).toBeInTheDocument();
    expect(screen.getByText("1234")).toBeInTheDocument();
    expect(screen.getByText("req")).toBeInTheDocument();
    expect(screen.getByText("Latency")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("ms")).toBeInTheDocument();
    expect(screen.getByText("-5")).toBeInTheDocument();
  });

  it("renders sections grouped by category", () => {
    const payload = createMockPayload({
      sections: [
        {
          id: "s1",
          category: "what",
          title: "Top events",
          insight: "Events are up",
          widget: { kind: "stat", value: 100 },
        },
        {
          id: "s2",
          category: "when",
          title: "Peak hours",
          widget: { kind: "stat", value: 5 },
        },
        {
          id: "s3",
          category: "what",
          title: "Error types",
          widget: { kind: "stat", value: 3 },
        },
      ],
    });

    render(<InsightsTab payload={payload} agentId="test-agent" window="7d" />);

    expect(screen.getByText("Top events")).toBeInTheDocument();
    expect(screen.getByText("Events are up")).toBeInTheDocument();
    expect(screen.getByText("Peak hours")).toBeInTheDocument();
    expect(screen.getByText("Error types")).toBeInTheDocument();

    const widgetRenderers = screen.getAllByTestId("widget-renderer");

    expect(widgetRenderers).toHaveLength(3);
  });

  it("renders window switcher with current window", () => {
    const payload = createMockPayload();

    render(<InsightsTab payload={payload} agentId="test-agent" window="30d" />);

    const switcher = screen.getByTestId("window-switcher");

    expect(switcher).toHaveAttribute("data-current", "30d");
  });
});
