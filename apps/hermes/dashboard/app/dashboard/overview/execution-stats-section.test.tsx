import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { getExecutionStatusCounts } from "@/lib/dashboard-overview";

const getExecutionStatusCountsMock = vi.fn<typeof getExecutionStatusCounts>();

vi.mock("@/lib/require-dashboard-admin", () => ({
  withDashboardAdmin: <Value,>(load: Promise<Value>) => load,
}));

vi.mock("@/lib/dashboard-overview", () => ({
  getExecutionStatusCounts: (since: Date) =>
    getExecutionStatusCountsMock(since),
}));

import { ExecutionStatsSection } from "./execution-stats-section";

const now = new Date("2026-09-28T12:00:00.000Z");

describe("ExecutionStatsSection", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(now);
  });

  afterEach(() => {
    vi.useRealTimers();
    getExecutionStatusCountsMock.mockReset();
  });

  it("loads counts for the last 24 hours and renders each KPI", async () => {
    // Setup
    getExecutionStatusCountsMock.mockResolvedValue({
      total: 42,
      running: 3,
      succeeded: 36,
      failed: 2,
      cancelled: 1,
    });

    // Act
    render(await ExecutionStatsSection());

    // Assert
    const runsValue = screen.getByText("Runs in the last 24h").nextSibling;
    const runningValue = screen.getByText("Running now").nextSibling;
    const succeededValue = screen.getByText("Succeeded").nextSibling;
    const failedValue = screen.getByText("Failed").nextSibling;

    expect(getExecutionStatusCountsMock).toHaveBeenCalledWith(
      new Date("2026-09-27T12:00:00.000Z"),
    );
    expect(runsValue).toHaveTextContent("42");
    expect(runningValue).toHaveTextContent("3");
    expect(succeededValue).toHaveTextContent("36");
    expect(failedValue).toHaveTextContent("2");
  });

  it("highlights the failed count when there are failures", async () => {
    // Setup
    getExecutionStatusCountsMock.mockResolvedValue({
      total: 5,
      running: 0,
      succeeded: 4,
      failed: 1,
      cancelled: 0,
    });

    // Act
    render(await ExecutionStatsSection());

    // Assert
    const failedValue = screen.getByText("Failed").nextSibling;

    expect(failedValue).toHaveClass("text-destructive");
  });

  it("keeps the failed count neutral when nothing failed", async () => {
    // Setup
    getExecutionStatusCountsMock.mockResolvedValue({
      total: 0,
      running: 0,
      succeeded: 0,
      failed: 0,
      cancelled: 0,
    });

    // Act
    render(await ExecutionStatsSection());

    // Assert
    const failedValue = screen.getByText("Failed").nextSibling;

    expect(failedValue).toHaveTextContent("0");
    expect(failedValue).not.toHaveClass("text-destructive");
  });
});
