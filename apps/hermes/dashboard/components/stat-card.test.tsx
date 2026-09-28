import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StatCard, StatCardGrid } from "./stat-card";

describe("StatCard", () => {
  it("shows the label, value, trend badge and footer", () => {
    render(
      <StatCard
        label="Runs (24h)"
        value="1,284"
        trend={{ direction: "up", label: "+8%" }}
        headline="More runs than the day before"
        description="Schedules, HTTP triggers and manual runs"
      />,
    );

    expect(screen.getByText("Runs (24h)")).toBeInTheDocument();
    expect(screen.getByText("1,284")).toBeInTheDocument();
    expect(screen.getByText("+8%")).toHaveAttribute("data-slot", "badge");
    expect(
      screen.getByText("More runs than the day before"),
    ).toBeInTheDocument();
  });

  it("omits the badge and footer when not given", () => {
    const { container } = render(<StatCard label="Running now" value="3" />);

    expect(container.querySelector('[data-slot="badge"]')).toBeNull();
    expect(container.querySelector('[data-slot="card-footer"]')).toBeNull();
  });
});

describe("StatCardGrid", () => {
  it("lays cards out with the dashboard container queries", () => {
    const { container } = render(
      <StatCardGrid>
        <StatCard label="A" value="1" />
      </StatCardGrid>,
    );

    expect(container.firstChild).toHaveClass(
      "@xl/main:grid-cols-2",
      "@5xl/main:grid-cols-4",
    );
  });
});
