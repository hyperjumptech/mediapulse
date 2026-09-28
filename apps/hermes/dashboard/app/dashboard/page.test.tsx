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

vi.mock("./overview/overview-activity-section", () => ({
  OverviewActivitySection: () => (
    <div data-testid="overview-activity-section" />
  ),
}));

import DashboardPage from "./page";

describe("DashboardPage", () => {
  it("renders the KPI cards, the activity chart and the activity table", () => {
    render(<DashboardPage />);

    expect(screen.getByTestId("execution-stats-section")).toBeInTheDocument();
    expect(
      screen.getByTestId("execution-activity-section"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("overview-activity-section")).toBeInTheDocument();
  });
});
