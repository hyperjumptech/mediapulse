import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  getUpcomingSchedules,
  UpcomingSchedule,
} from "@/lib/dashboard-overview";

const getUpcomingSchedulesMock = vi.fn<typeof getUpcomingSchedules>();

vi.mock("@/lib/require-dashboard-admin", () => ({
  withDashboardAdmin: <Value,>(load: Promise<Value>) => load,
}));

vi.mock("@/lib/dashboard-overview", () => ({
  getUpcomingSchedules: () => getUpcomingSchedulesMock(),
}));

import { UpcomingSchedulesSection } from "./upcoming-schedules-section";

const now = new Date("2026-09-28T12:00:00.000Z");

const viewerTimestampFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

const activeSchedule: UpcomingSchedule = {
  id: "schedule-1",
  name: "Morning digest",
  nextRunAt: new Date("2026-09-28T12:12:00.000Z"),
  pipeline: { id: "pipeline-1", name: "Newsletter", isActive: true },
};

const scheduleWithDisabledPipeline: UpcomingSchedule = {
  id: "schedule-2",
  name: "Nightly sweep",
  nextRunAt: new Date("2026-09-28T17:00:00.000Z"),
  pipeline: { id: "pipeline-2", name: "Knowledge base", isActive: false },
};

describe("UpcomingSchedulesSection", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(now);
  });

  afterEach(() => {
    vi.useRealTimers();
    getUpcomingSchedulesMock.mockReset();
  });

  it("renders each schedule with its pipeline and next run time", async () => {
    // Setup
    getUpcomingSchedulesMock.mockResolvedValue([
      activeSchedule,
      scheduleWithDisabledPipeline,
    ]);

    // Act
    render(await UpcomingSchedulesSection());

    // Assert
    const links = screen.getAllByRole("link");
    const nextRun = screen.getByText("in 12m");

    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute("href", "/dashboard/schedules/schedule-1");
    expect(links[0]).toHaveTextContent("Morning digest");
    expect(links[0]).toHaveTextContent("Newsletter");
    expect(links[1]).toHaveAttribute("href", "/dashboard/schedules/schedule-2");
    expect(links[1]).toHaveTextContent("in 5h");
    expect(nextRun).toHaveAttribute("dateTime", "2026-09-28T12:12:00.000Z");
    expect(nextRun).toHaveAttribute(
      "title",
      viewerTimestampFormatter.format(activeSchedule.nextRunAt),
    );
  });

  it("marks only schedules whose pipeline is disabled", async () => {
    // Setup
    getUpcomingSchedulesMock.mockResolvedValue([
      activeSchedule,
      scheduleWithDisabledPipeline,
    ]);

    // Act
    render(await UpcomingSchedulesSection());

    // Assert
    const disabledBadges = screen.getAllByText("Pipeline disabled");
    const links = screen.getAllByRole("link");

    expect(disabledBadges).toHaveLength(1);
    expect(disabledBadges[0]).toHaveAttribute("data-variant", "muted");
    expect(disabledBadges[0]).toHaveClass("normal-case");
    expect(links[1]).toContainElement(disabledBadges[0] ?? null);
  });

  it("renders an empty state when no schedule is due", async () => {
    // Setup
    getUpcomingSchedulesMock.mockResolvedValue([]);

    // Act
    render(await UpcomingSchedulesSection());

    // Assert
    expect(screen.getByText("No upcoming runs.")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
