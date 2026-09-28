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
    // Act
    renderScheduleDetail(createMockSchedule());

    // Assert
    expect(
      screen.queryByRole("link", { name: /back to schedules/i }),
    ).not.toBeInTheDocument();
  });

  it("renders the schedule name, status and description in the header", () => {
    // Act
    renderScheduleDetail(createMockSchedule());

    // Assert
    expect(screen.getByText("enabled")).toHaveAttribute("data-tone", "success");
    expect(screen.getByText("Runs every day")).toBeInTheDocument();
  });

  it("shows a muted Disabled badge when the schedule is disabled", () => {
    // Act
    renderScheduleDetail(createMockSchedule({ enabled: false }));

    // Assert
    expect(screen.getByText("disabled")).toHaveAttribute("data-tone", "muted");
  });

  it("omits the description when the schedule has none", () => {
    // Act
    renderScheduleDetail(createMockSchedule({ description: null }));

    // Assert
    expect(screen.queryByText("Runs every day")).not.toBeInTheDocument();
  });

  it("links the pipeline from the summary", () => {
    // Act
    renderScheduleDetail(createMockSchedule());

    // Assert
    const pipelineLink = within(summaryValue("Pipeline")).getByRole("link", {
      name: "Main",
    });

    expect(pipelineLink).toHaveAttribute("href", "/dashboard/pipelines/p1");
  });

  it("shows a cron cadence in monospace and the timezone", () => {
    // Act
    renderScheduleDetail(createMockSchedule({ timezone: "Asia/Jakarta" }));

    // Assert
    const cadence = within(summaryValue("Repeats")).getByText("0 6 * * *");

    expect(cadence.tagName).toBe("CODE");
    expect(summaryValue("Timezone")).toHaveTextContent("Asia/Jakarta");
  });

  it("describes interval cadences in words", () => {
    // Act
    renderScheduleDetail(
      createMockSchedule({ cronExpression: null, interval: 3_600_000 }),
    );

    // Assert
    expect(summaryValue("Repeats")).toHaveTextContent("Hourly");
  });

  it("shows the next run in the viewer zone and in the schedule timezone", () => {
    // Act
    renderScheduleDetail(
      createMockSchedule({
        nextRunAt: new Date("2026-09-29T06:00:00Z"),
        timezone: "Asia/Jakarta",
      }),
    );

    // Assert
    const nextRun = summaryValue("Next run");

    expect(within(nextRun).getByText("in 18h").closest("time")).toHaveAttribute(
      "datetime",
      "2026-09-29T06:00:00.000Z",
    );
    expect(nextRun).toHaveTextContent("Sep 29, 2026, 06:00 in 18h");
    expect(nextRun).toHaveTextContent("Sep 29, 2026, 13:00 in Asia/Jakarta");
  });

  it("shows only the viewer zone when the schedule timezone is not recognised", () => {
    // Act
    renderScheduleDetail(
      createMockSchedule({
        nextRunAt: new Date("2026-09-29T06:00:00Z"),
        timezone: "Not/AZone",
      }),
    );

    // Assert
    expect(summaryValue("Next run")).toHaveTextContent(
      "Sep 29, 2026, 06:00 in 18h",
    );
    expect(summaryValue("Next run")).not.toHaveTextContent("Not/AZone");
  });

  it("shows none scheduled when enabled without a next run", () => {
    // Act
    renderScheduleDetail(createMockSchedule({ nextRunAt: null }));

    // Assert
    expect(summaryValue("Next run")).toHaveTextContent("None scheduled");
  });

  it("shows the disabled next-run copy when the schedule is disabled", () => {
    // Act
    renderScheduleDetail(createMockSchedule({ enabled: false }));

    // Assert
    expect(summaryValue("Next run")).toHaveTextContent("Not while disabled");
  });

  it("shows when and by whom the schedule was created", () => {
    // Act
    renderScheduleDetail(createMockSchedule());

    // Assert
    expect(summaryValue("Created")).toHaveTextContent("Sep 25, 2026, 12:00");
    expect(summaryValue("Created by")).toHaveTextContent("Kevin");
  });

  it("hides the recovery summary when the schedule never recovered", () => {
    // Act
    renderScheduleDetail(createMockSchedule());

    // Assert
    expect(
      screen.queryByText("Last recovered", { selector: "dt" }),
    ).not.toBeInTheDocument();
  });

  it("shows the last recovery with the skipped run count", () => {
    // Act
    renderScheduleDetail(
      createMockSchedule({
        lastRecoveredAt: new Date("2026-09-28T10:00:00Z"),
        lastMissedRunCount: 3,
      }),
    );

    // Assert
    const lastRecovered = summaryValue("Last recovered");

    expect(lastRecovered).toHaveTextContent("2h ago");
    expect(lastRecovered).toHaveTextContent("Skipped 3 missed runs");
  });

  it("uses the singular for one skipped run", () => {
    // Act
    renderScheduleDetail(
      createMockSchedule({
        lastRecoveredAt: new Date("2026-09-28T10:00:00Z"),
        lastMissedRunCount: 1,
      }),
    );

    // Assert
    expect(summaryValue("Last recovered")).toHaveTextContent(
      "Skipped 1 missed run",
    );
  });

  it("omits the skipped run count when it is unknown", () => {
    // Act
    renderScheduleDetail(
      createMockSchedule({
        lastRecoveredAt: new Date("2026-09-28T10:00:00Z"),
        lastMissedRunCount: null,
      }),
    );

    // Assert
    expect(summaryValue("Last recovered")).not.toHaveTextContent("Skipped");
  });

  it("opens the edit modal from the header action", () => {
    // Setup
    renderScheduleDetail(createMockSchedule());
    const modal = screen.getByTestId("schedule-form-modal");

    // Act
    fireEvent.click(screen.getByRole("button", { name: "Edit schedule" }));

    // Assert
    expect(modal).toHaveAttribute("data-open", "true");
    expect(modal).toHaveAttribute("data-mode", "edit");
    expect(modal).toHaveAttribute("data-edit-id", "sched-1");
  });

  it("keeps the edit modal closed until requested", () => {
    // Act
    renderScheduleDetail(createMockSchedule());

    // Assert
    expect(screen.getByTestId("schedule-form-modal")).toHaveAttribute(
      "data-open",
      "false",
    );
  });

  it("renders the executions section under the Executions heading", () => {
    // Act
    renderScheduleDetail(createMockSchedule());

    // Assert
    const heading = screen.getByRole("heading", {
      level: 2,
      name: "Executions",
    });
    const section = heading.closest("section") as HTMLElement;

    expect(
      within(section).getByTestId("executions-section"),
    ).toBeInTheDocument();
  });
});
