import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./overview/execution-stats-section", () => ({
  ExecutionStatsSection: () => <div data-testid="execution-stats-section" />,
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
  it("renders the overview header", () => {
    // Act
    render(<DashboardPage />);

    // Assert
    expect(
      screen.getByRole("heading", { name: "Dashboard", level: 1 }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("What Hermes is running now and what needs attention."),
    ).toBeInTheDocument();
  });

  it("renders the execution stats and every overview panel", () => {
    // Act
    render(<DashboardPage />);

    // Assert
    expect(screen.getByTestId("execution-stats-section")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Running now", level: 2 }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("active-executions-section")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Upcoming runs", level: 2 }),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("upcoming-schedules-section"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Recent failures (7 days)",
        level: 2,
      }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("recent-failures-section")).toBeInTheDocument();
  });
});
