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

vi.mock("@workspace/ui/components/tooltip", () => ({
  SimpleTooltip: ({
    children,
    content,
  }: {
    children: React.ReactNode;
    content: string;
  }) => (
    <div data-testid="simple-tooltip" data-content={content}>
      {children}
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

    render(<InsightsTab payload={payload} window="7d" />);

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

    render(<InsightsTab payload={payload} window="7d" />);

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

    render(<InsightsTab payload={payload} window="7d" />);

    expect(screen.getByText("Requests")).toBeInTheDocument();
    expect(screen.getByText("1234")).toBeInTheDocument();
    expect(screen.getByText("req")).toBeInTheDocument();
    expect(screen.getByText("Latency")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("ms")).toBeInTheDocument();
    expect(screen.getByText("-5")).toBeInTheDocument();
  });

  it("wraps each KPI card in a SimpleTooltip", () => {
    const payload = createMockPayload({
      kpis: [
        { id: "k1", label: "Requests", value: 1234 },
        { id: "k2", label: "Latency", value: 42, delta: -5 },
      ],
    });

    render(<InsightsTab payload={payload} window="7d" />);

    const tooltips = screen.getAllByTestId("simple-tooltip");
    const kpiTooltips = tooltips.filter(
      (element) =>
        element.getAttribute("data-content")?.includes("Requests") ||
        element.getAttribute("data-content")?.includes("Latency"),
    );

    expect(kpiTooltips).toHaveLength(2);
  });

  it("KPI tooltip includes delta basis text when delta is present", () => {
    const payload = createMockPayload({
      kpis: [{ id: "k1", label: "Latency", value: 42, delta: -5 }],
    });

    render(<InsightsTab payload={payload} window="7d" />);

    const tooltip = screen
      .getAllByTestId("simple-tooltip")
      .find((element) =>
        element.getAttribute("data-content")?.includes("prior period"),
      );

    expect(tooltip).toBeTruthy();
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

    render(<InsightsTab payload={payload} window="7d" />);

    expect(screen.getByText("Top events")).toBeInTheDocument();
    expect(screen.getByText("Events are up")).toBeInTheDocument();
    expect(screen.getByText("Peak hours")).toBeInTheDocument();
    expect(screen.getByText("Error types")).toBeInTheDocument();

    const widgetRenderers = screen.getAllByTestId("widget-renderer");

    expect(widgetRenderers).toHaveLength(3);
  });

  it("wraps section title in a SimpleTooltip when insight text is available", () => {
    const payload = createMockPayload({
      sections: [
        {
          id: "s1",
          category: "what",
          title: "Top events",
          insight: "Events are up this week",
          widget: { kind: "stat", value: 100 },
        },
      ],
    });

    render(<InsightsTab payload={payload} window="7d" />);

    const tooltip = screen
      .getAllByTestId("simple-tooltip")
      .find(
        (element) =>
          element.getAttribute("data-content") === "Events are up this week",
      );

    expect(tooltip).toBeTruthy();
  });

  it("wraps section title in a SimpleTooltip using category hint when no insight", () => {
    const payload = createMockPayload({
      sections: [
        {
          id: "s1",
          category: "when",
          title: "Peak hours",
          widget: { kind: "stat", value: 5 },
        },
      ],
    });

    render(<InsightsTab payload={payload} window="7d" />);

    const tooltip = screen
      .getAllByTestId("simple-tooltip")
      .find((element) =>
        element.getAttribute("data-content")?.includes("timing"),
      );

    expect(tooltip).toBeTruthy();
  });

  it("renders window switcher with current window", () => {
    const payload = createMockPayload();

    render(<InsightsTab payload={payload} window="30d" />);

    const switcher = screen.getByTestId("window-switcher");

    expect(switcher).toHaveAttribute("data-current", "30d");
  });
});
