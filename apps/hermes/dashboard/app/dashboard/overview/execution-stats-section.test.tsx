import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  ExecutionStatusCounts,
  ExecutionWindow,
} from "@/lib/dashboard-overview";

const countsInWindowMock =
  vi.fn<(window: ExecutionWindow) => Promise<ExecutionStatusCounts>>();

vi.mock("@/lib/require-dashboard-admin", () => ({
  withDashboardAdmin: <Value,>(load: Promise<Value>) => load,
}));

vi.mock("@/lib/dashboard-overview", () => ({
  getExecutionStatusCountsInWindow: (window: ExecutionWindow) =>
    countsInWindowMock(window),
}));

import { ExecutionStatsSection } from "./execution-stats-section";

const now = new Date("2026-09-28T12:00:00.000Z");

const counts = (
  overrides: Partial<ExecutionStatusCounts>,
): ExecutionStatusCounts => ({
  total: 0,
  running: 0,
  succeeded: 0,
  failed: 0,
  cancelled: 0,
  ...overrides,
});

const cardFor = (label: string) =>
  screen.getByText(label).closest('[data-slot="card"]') as HTMLElement;

describe("ExecutionStatsSection", () => {
  afterEach(() => {
    countsInWindowMock.mockReset();
  });

  it("compares the last 24 hours with the day before", async () => {
    countsInWindowMock
      .mockResolvedValueOnce(
        counts({ total: 12, running: 2, succeeded: 9, failed: 1 }),
      )
      .mockResolvedValueOnce(counts({ total: 10, succeeded: 10 }));

    render(await ExecutionStatsSection({ now }));

    expect(countsInWindowMock).toHaveBeenNthCalledWith(1, {
      since: new Date("2026-09-27T12:00:00.000Z"),
    });
    expect(countsInWindowMock).toHaveBeenNthCalledWith(2, {
      since: new Date("2026-09-26T12:00:00.000Z"),
      until: new Date("2026-09-27T12:00:00.000Z"),
    });
    expect(cardFor("Runs (24h)")).toHaveTextContent("12");
    expect(cardFor("Runs (24h)")).toHaveTextContent("+20%");
    expect(cardFor("Success rate (24h)")).toHaveTextContent("90%");
    expect(cardFor("Success rate (24h)")).toHaveTextContent("-10 pts");
    expect(cardFor("Running now")).toHaveTextContent("2");
  });

  it("highlights failures", async () => {
    countsInWindowMock
      .mockResolvedValueOnce(counts({ total: 3, failed: 2, succeeded: 1 }))
      .mockResolvedValueOnce(counts({}));

    render(await ExecutionStatsSection({ now }));

    const failedCard = cardFor("Failed runs (24h)");

    expect(failedCard).toHaveTextContent("Needs attention");
    expect(failedCard.querySelector(".text-destructive")).toHaveTextContent(
      "2",
    );
  });

  it("stays neutral when nothing ran", async () => {
    countsInWindowMock.mockResolvedValue(counts({}));

    render(await ExecutionStatsSection({ now }));

    expect(cardFor("Success rate (24h)")).toHaveTextContent("—");
    expect(cardFor("Failed runs (24h)")).toHaveTextContent("No failures");
  });
});
