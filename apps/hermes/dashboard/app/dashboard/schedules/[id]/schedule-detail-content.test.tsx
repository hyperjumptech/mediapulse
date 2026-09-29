import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ScheduleDetailContent,
  type ScheduleDetailContentProps,
} from "./schedule-detail-content";

vi.mock("../schedule-form-modal", () => ({
  ScheduleFormModal: ({
    open,
    mode,
    editScheduleId,
  }: {
    open: boolean;
    mode: string;
    editScheduleId: string | null;
  }) => (
    <div
      data-testid="schedule-form-modal"
      data-open={open}
      data-mode={mode}
      data-edit-id={editScheduleId ?? "none"}
    />
  ),
}));

type ScheduleRow = ScheduleDetailContentProps["schedule"];
type PipelineRow = ScheduleRow["pipeline"];

const defaultMockPipeline: PipelineRow = {
  id: "p1",
  name: "Main",
  description: null,
  timeout: null,
  isActive: true,
  executionConfig: null,
  domainIntegrationId: "00000000-0000-4000-8000-000000000001",
  createdById: null,
  createdAt: new Date(0),
  updatedAt: new Date(0),
};

const createMockSchedule = (
  overrides?: Partial<Omit<ScheduleRow, "pipeline">> & {
    pipeline?: Partial<PipelineRow>;
  },
): ScheduleRow => {
  const { pipeline: pipelineOverrides, ...scheduleOverrides } = overrides ?? {};

  return {
    id: "sched-1",
    name: "Daily Run",
    description: "Runs every day",
    pipeline: { ...defaultMockPipeline, ...pipelineOverrides },
    repeat: "repeating",
    cronExpression: "0 6 * * *",
    interval: null,
    timezone: "UTC",
    startAt: null,
    nextRunAt: new Date("2026-09-29T06:00:00Z"),
    pipelineId: "p1",
    retryConfig: null,
    executionConfig: null,
    priority: 0,
    enabled: true,
    lastRecoveredAt: null,
    lastMissedRunCount: null,
    createdAt: new Date("2026-09-25T12:00:00Z"),
    updatedAt: new Date("2026-09-25T12:00:00Z"),
    createdById: null,
    createdBy: { id: "u1", name: "Kevin", email: "kevin@example.com" },
    ...scheduleOverrides,
  };
};

const renderScheduleDetail = (schedule: ScheduleRow) =>
  render(
    <ScheduleDetailContent
      schedule={schedule}
      executionsSection={<div data-testid="executions-section" />}
      pipelines={[]}
      pipelineValidationById={{}}
    />,
  );

const summaryValue = (label: string) => {
  const term = screen.getByText(label, { selector: "dt" });

  return term.nextElementSibling as HTMLElement;
};

describe("ScheduleDetailContent", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-28T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders no back link because the shell shows breadcrumbs", () => {
    renderScheduleDetail(createMockSchedule());

    expect(
      screen.queryByRole("link", { name: /back to schedules/i }),
    ).not.toBeInTheDocument();
  });

  it("renders the schedule name, status and description in the header", () => {
    renderScheduleDetail(createMockSchedule());

    expect(screen.getByText("enabled")).toHaveAttribute("data-tone", "success");
    expect(screen.getByText("Runs every day")).toBeInTheDocument();
  });

  it("shows a muted Disabled badge when the schedule is disabled", () => {
    renderScheduleDetail(createMockSchedule({ enabled: false }));

    expect(screen.getByText("disabled")).toHaveAttribute("data-tone", "muted");
  });

  it("omits the description when the schedule has none", () => {
    renderScheduleDetail(createMockSchedule({ description: null }));

    expect(screen.queryByText("Runs every day")).not.toBeInTheDocument();
  });

  it("links the pipeline from the summary", () => {
    renderScheduleDetail(createMockSchedule());

    const pipelineLink = within(summaryValue("Pipeline")).getByRole("link", {
      name: "Main",
    });

    expect(pipelineLink).toHaveAttribute("href", "/dashboard/pipelines/p1");
  });

  it("puts a common cron cadence into words next to the time zone", () => {
    renderScheduleDetail(createMockSchedule({ timezone: "Asia/Jakarta" }));

    expect(summaryValue("Repeats")).toHaveTextContent("Daily at 06:00");
    expect(summaryValue("Time zone")).toHaveTextContent("Asia/Jakarta");
  });

  it("describes interval cadences in words", () => {
    renderScheduleDetail(
      createMockSchedule({ cronExpression: null, interval: 3_600_000 }),
    );

    expect(summaryValue("Repeats")).toHaveTextContent("Hourly");
  });

  it("shows the next run in the viewer zone and in the schedule timezone", () => {
    renderScheduleDetail(
      createMockSchedule({
        nextRunAt: new Date("2026-09-29T06:00:00Z"),
        timezone: "Asia/Jakarta",
      }),
    );

    const nextRun = summaryValue("Next run");

    expect(within(nextRun).getByText("in 18h").closest("time")).toHaveAttribute(
      "datetime",
      "2026-09-29T06:00:00.000Z",
    );
    expect(nextRun).toHaveTextContent("Sep 29, 2026, 06:00 in 18h");
    expect(nextRun).toHaveTextContent("Sep 29, 2026, 13:00 in Asia/Jakarta");
  });

  it("shows only the viewer zone when the schedule timezone is not recognised", () => {
    renderScheduleDetail(
      createMockSchedule({
        nextRunAt: new Date("2026-09-29T06:00:00Z"),
        timezone: "Not/AZone",
      }),
    );

    expect(summaryValue("Next run")).toHaveTextContent(
      "Sep 29, 2026, 06:00 in 18h",
    );
    expect(summaryValue("Next run")).not.toHaveTextContent("Not/AZone");
  });

  it("shows none scheduled when enabled without a next run", () => {
    renderScheduleDetail(createMockSchedule({ nextRunAt: null }));

    expect(summaryValue("Next run")).toHaveTextContent("None scheduled");
  });

  it("shows the disabled next-run copy when the schedule is disabled", () => {
    renderScheduleDetail(createMockSchedule({ enabled: false }));

    expect(summaryValue("Next run")).toHaveTextContent("Not while disabled");
  });

  it("leaves out who created the schedule and when", () => {
    renderScheduleDetail(createMockSchedule());

    expect(screen.queryByText("Created by")).not.toBeInTheDocument();
    expect(screen.queryByText("Created")).not.toBeInTheDocument();
  });

  it("hides the recovery summary when the schedule never recovered", () => {
    renderScheduleDetail(createMockSchedule());

    expect(
      screen.queryByText("Last recovered", { selector: "dt" }),
    ).not.toBeInTheDocument();
  });

  it("shows the last recovery with the skipped run count", () => {
    renderScheduleDetail(
      createMockSchedule({
        lastRecoveredAt: new Date("2026-09-28T10:00:00Z"),
        lastMissedRunCount: 3,
      }),
    );

    const lastRecovered = summaryValue("Last recovered");

    expect(lastRecovered).toHaveTextContent("2h ago");
    expect(lastRecovered).toHaveTextContent("Skipped 3 missed runs");
  });

  it("uses the singular for one skipped run", () => {
    renderScheduleDetail(
      createMockSchedule({
        lastRecoveredAt: new Date("2026-09-28T10:00:00Z"),
        lastMissedRunCount: 1,
      }),
    );

    expect(summaryValue("Last recovered")).toHaveTextContent(
      "Skipped 1 missed run",
    );
  });

  it("omits the skipped run count when it is unknown", () => {
    renderScheduleDetail(
      createMockSchedule({
        lastRecoveredAt: new Date("2026-09-28T10:00:00Z"),
        lastMissedRunCount: null,
      }),
    );

    expect(summaryValue("Last recovered")).not.toHaveTextContent("Skipped");
  });

  it("opens the edit modal from the header action", () => {
    renderScheduleDetail(createMockSchedule());
    const modal = screen.getByTestId("schedule-form-modal");

    fireEvent.click(screen.getByRole("button", { name: "Edit schedule" }));

    expect(modal).toHaveAttribute("data-open", "true");
    expect(modal).toHaveAttribute("data-mode", "edit");
    expect(modal).toHaveAttribute("data-edit-id", "sched-1");
  });

  it("keeps the edit modal closed until requested", () => {
    renderScheduleDetail(createMockSchedule());

    expect(screen.getByTestId("schedule-form-modal")).toHaveAttribute(
      "data-open",
      "false",
    );
  });

  it("renders the executions section in its own section", () => {
    renderScheduleDetail(createMockSchedule());

    const section = screen
      .getByTestId("executions-section")
      .closest("section") as HTMLElement;

    expect(section).toBeInTheDocument();
  });
});
