import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WidgetRenderer } from "./widget-renderer";

vi.mock("recharts", () => ({
  AreaChart: ({
    children,
    margin,
  }: React.PropsWithChildren<{ margin?: Record<string, number> }>) => (
    <div data-testid="area-chart" data-margin={JSON.stringify(margin)}>
      {children}
    </div>
  ),
  Area: () => <div data-testid="area" />,
  BarChart: ({
    children,
    margin,
  }: React.PropsWithChildren<{ margin?: Record<string, number> }>) => (
    <div data-testid="bar-chart" data-margin={JSON.stringify(margin)}>
      {children}
    </div>
  ),
  Bar: ({ children }: React.PropsWithChildren) => (
    <div data-testid="bar">{children}</div>
  ),
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: ({ width }: { width?: number }) => (
    <div data-testid="y-axis" data-width={width} />
  ),
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Cell: () => <div data-testid="cell" />,
}));

vi.mock("@workspace/ui/components/chart", () => ({
  ChartContainer: ({ children }: React.PropsWithChildren) => (
    <div data-testid="chart-container">{children}</div>
  ),
  ChartTooltip: () => <div data-testid="chart-tooltip" />,
  ChartTooltipContent: () => null,
}));

describe("WidgetRenderer", () => {
  it("renders stat widget with value and unit", () => {
    render(
      <WidgetRenderer
        widget={{ kind: "stat", value: 42, unit: "ms", delta: 5 }}
      />,
    );

    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("ms")).toBeInTheDocument();
    expect(screen.getByText("+5 vs prior period")).toBeInTheDocument();
  });

  it("renders stat widget with negative delta", () => {
    render(<WidgetRenderer widget={{ kind: "stat", value: 10, delta: -3 }} />);

    expect(screen.getByText("-3 vs prior period")).toBeInTheDocument();
  });

  it("renders stat widget without delta", () => {
    render(<WidgetRenderer widget={{ kind: "stat", value: 7 }} />);

    expect(screen.getByText("7")).toBeInTheDocument();
  });

  it("renders timeSeries widget with an area chart", () => {
    render(
      <WidgetRenderer
        widget={{
          kind: "timeSeries",
          points: [
            { ts: "2024-01-01", value: 10 },
            { ts: "2024-01-02", value: 20 },
          ],
        }}
      />,
    );

    expect(screen.getByTestId("area-chart")).toBeInTheDocument();
  });

  it("timeSeries chart has no negative left margin", () => {
    render(
      <WidgetRenderer
        widget={{
          kind: "timeSeries",
          points: [{ ts: "2024-01-01", value: 10 }],
        }}
      />,
    );

    const chart = screen.getByTestId("area-chart");
    const margin = JSON.parse(
      chart.getAttribute("data-margin") ?? "{}",
    ) as Record<string, number>;

    expect(margin.left).toBeGreaterThanOrEqual(0);
  });

  it("timeSeries Y-axis has explicit width to prevent label clipping", () => {
    render(
      <WidgetRenderer
        widget={{
          kind: "timeSeries",
          points: [{ ts: "2024-01-01", value: 10 }],
        }}
      />,
    );

    const yAxis = screen.getByTestId("y-axis");

    expect(Number(yAxis.getAttribute("data-width"))).toBeGreaterThan(0);
  });

  it("timeSeries chart renders a ChartTooltip", () => {
    render(
      <WidgetRenderer
        widget={{
          kind: "timeSeries",
          points: [{ ts: "2024-01-01", value: 10 }],
        }}
      />,
    );

    expect(screen.getByTestId("chart-tooltip")).toBeInTheDocument();
  });

  it("renders categoryBar widget with a bar chart", () => {
    render(
      <WidgetRenderer
        widget={{
          kind: "categoryBar",
          bars: [
            { label: "A", value: 5 },
            { label: "B", value: 10 },
          ],
        }}
      />,
    );

    expect(screen.getByTestId("bar-chart")).toBeInTheDocument();
  });

  it("categoryBar chart has no negative left margin", () => {
    render(
      <WidgetRenderer
        widget={{
          kind: "categoryBar",
          bars: [{ label: "A", value: 5 }],
        }}
      />,
    );

    const chart = screen.getByTestId("bar-chart");
    const margin = JSON.parse(
      chart.getAttribute("data-margin") ?? "{}",
    ) as Record<string, number>;

    expect(margin.left).toBeGreaterThanOrEqual(0);
  });

  it("categoryBar chart renders a ChartTooltip", () => {
    render(
      <WidgetRenderer
        widget={{
          kind: "categoryBar",
          bars: [{ label: "A", value: 5 }],
        }}
      />,
    );

    expect(screen.getByTestId("chart-tooltip")).toBeInTheDocument();
  });

  it("renders histogram widget with a bar chart", () => {
    render(
      <WidgetRenderer
        widget={{
          kind: "histogram",
          buckets: [
            { label: "0-10", count: 3 },
            { label: "10-20", count: 7 },
          ],
        }}
      />,
    );

    expect(screen.getByTestId("bar-chart")).toBeInTheDocument();
  });

  it("histogram chart renders a ChartTooltip", () => {
    render(
      <WidgetRenderer
        widget={{
          kind: "histogram",
          buckets: [{ label: "0-10", count: 3 }],
        }}
      />,
    );

    expect(screen.getByTestId("chart-tooltip")).toBeInTheDocument();
  });

  it("renders funnel widget with stages and percentages", () => {
    render(
      <WidgetRenderer
        widget={{
          kind: "funnel",
          stages: [
            { label: "Top", value: 100 },
            { label: "Middle", value: 50 },
            { label: "Bottom", value: 25 },
          ],
        }}
      />,
    );

    expect(screen.getByText("Top")).toBeInTheDocument();
    expect(screen.getByText("100%")).toBeInTheDocument();
    expect(screen.getByText("Middle")).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(screen.getByText("Bottom")).toBeInTheDocument();
    expect(screen.getByText("25%")).toBeInTheDocument();
  });

  it("renders breakdown widget with labels and percentages", () => {
    render(
      <WidgetRenderer
        widget={{
          kind: "breakdown",
          slices: [
            { label: "Alpha", value: 60, fraction: 0.6 },
            { label: "Beta", value: 40, fraction: 0.4 },
          ],
        }}
      />,
    );

    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("60")).toBeInTheDocument();
    expect(screen.getByText("60%")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
    expect(screen.getByText("40")).toBeInTheDocument();
    expect(screen.getByText("40%")).toBeInTheDocument();
  });

  it("breakdown chart renders a ChartTooltip", () => {
    render(
      <WidgetRenderer
        widget={{
          kind: "breakdown",
          slices: [{ label: "Alpha", value: 60, fraction: 0.6 }],
        }}
      />,
    );

    expect(screen.getByTestId("chart-tooltip")).toBeInTheDocument();
  });

  it("renders table widget with columns and rows", () => {
    render(
      <WidgetRenderer
        widget={{
          kind: "table",
          columns: ["Name", "Count"],
          rows: [
            ["Alice", 10],
            ["Bob", 20],
          ],
        }}
      />,
    );

    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Count")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("20")).toBeInTheDocument();
  });

  it("renders table widget with null cell as dash", () => {
    render(
      <WidgetRenderer
        widget={{
          kind: "table",
          columns: ["Name"],
          rows: [[null]],
        }}
      />,
    );

    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders fallback for unknown widget kind", () => {
    render(
      // @ts-expect-error intentionally passing unknown kind for test
      <WidgetRenderer widget={{ kind: "unknown-kind-xyz" }} />,
    );

    expect(screen.getByText("Unsupported widget kind")).toBeInTheDocument();
  });
});
