import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ExecutionDailyPoint } from "@/lib/dashboard-overview";

vi.mock("@workspace/ui/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));

import { ExecutionActivityChart } from "./execution-activity-chart";

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const points: ExecutionDailyPoint[] = Array.from(
  { length: 90 },
  (_, index) => ({
    date: `2026-${String(7 + Math.floor(index / 31)).padStart(2, "0")}-${String((index % 28) + 1).padStart(2, "0")}`,
    total: index >= 83 ? 10 : 1,
    failed: index >= 83 ? 2 : 0,
  }),
);

describe("ExecutionActivityChart", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
  });

  it("summarizes the three-month total by default", () => {
    render(<ExecutionActivityChart points={points} />);

    expect(screen.getByText("Executions")).toBeInTheDocument();
    expect(
      screen.getByText("153 runs in the last 3 months"),
    ).toBeInTheDocument();
  });

  it("narrows the total when a shorter range is picked", async () => {
    render(<ExecutionActivityChart points={points} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("radio", { name: "Last 7 days" }));
    });

    expect(screen.getByText("70 runs in the last 7 days")).toBeInTheDocument();
  });
});
