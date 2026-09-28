import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./overview/execution-stats-section", () => ({
  ExecutionStatsSection: () => <div data-testid="execution-stats-section" />,
}));

vi.mock("./overview/execution-activity-section", () => ({
  ExecutionActivitySection: () => (
    <div data-testid="execution-activity-section" />
  ),
}));

vi.mock("./overview/active-executions-section", () => ({
  ActiveExecutionsSection: () => (
    <div data-testid="active-executions-section" />
  ),
}));

vi.mock("./overview/upcoming-schedules-section", () => ({
  UpcomingSchedulesSection: () => (
    <div data-testid="upcoming-schedules-section" />
  ),
}));

vi.mock("./overview/recent-failures-section", () => ({
  RecentFailuresSection: () => <div data-testid="recent-failures-section" />,
}));

import DashboardPage from "./page";

describe("DashboardPage", () => {
  it("renders the KPI cards, the activity chart and the activity tabs", () => {
    render(<DashboardPage />);

    expect(screen.getByTestId("execution-stats-section")).toBeInTheDocument();
    expect(
      screen.getByTestId("execution-activity-section"),
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Running" })).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: "Failed (7d)" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Upcoming" })).toBeInTheDocument();
    expect(screen.getByTestId("active-executions-section")).toBeInTheDocument();
  });
});
