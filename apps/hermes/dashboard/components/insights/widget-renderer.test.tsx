import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WidgetRenderer } from "./widget-renderer";

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: React.PropsWithChildren) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  LineChart: ({ children }: React.PropsWithChildren) => (
    <div data-testid="line-chart">{children}</div>
  ),
  BarChart: ({ children }: React.PropsWithChildren) => (
    <div data-testid="bar-chart">{children}</div>
  ),
  Line: () => <div data-testid="line" />,
  Bar: () => <div data-testid="bar" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  Tooltip: () => <div data-testid="tooltip" />,
  FunnelChart: ({ children }: React.PropsWithChildren) => (
    <div data-testid="funnel-chart">{children}</div>
  ),
  Funnel: () => <div data-testid="funnel" />,
  LabelList: () => <div data-testid="label-list" />,
  Cell: () => <div data-testid="cell" />,
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
    expect(screen.getByText("+5")).toBeInTheDocument();
  });

  it("renders stat widget with negative delta", () => {
    render(
      <WidgetRenderer widget={{ kind: "stat", value: 10, delta: -3 }} />,
    );

    expect(screen.getByText("-3")).toBeInTheDocument();
  });

  it("renders stat widget without delta", () => {
    render(<WidgetRenderer widget={{ kind: "stat", value: 7 }} />);

    expect(screen.getByText("7")).toBeInTheDocument();
  });

  it("renders timeSeries widget with a line chart", () => {
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

    expect(screen.getByTestId("line-chart")).toBeInTheDocument();
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
    expect(screen.getByText("100")).toBeInTheDocument();
    expect(screen.getByText("(100%)")).toBeInTheDocument();
    expect(screen.getByText("Middle")).toBeInTheDocument();
    expect(screen.getByText("50")).toBeInTheDocument();
    expect(screen.getByText("(50%)")).toBeInTheDocument();
    expect(screen.getByText("Bottom")).toBeInTheDocument();
    expect(screen.getByText("25")).toBeInTheDocument();
    expect(screen.getByText("(25%)")).toBeInTheDocument();
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
    expect(screen.getByText("(60%)")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
    expect(screen.getByText("40")).toBeInTheDocument();
    expect(screen.getByText("(40%)")).toBeInTheDocument();
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
