import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  ScheduleDetailContent,
  type ScheduleDetailContentProps,
} from "./schedule-detail-content";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

vi.mock("@workspace/ui/components/button", () => ({
  Button: ({
    children,
    onClick,
    variant,
  }: React.PropsWithChildren<{ onClick?: () => void; variant?: string }>) => (
    <button type="button" onClick={onClick} data-variant={variant}>
      {children}
    </button>
  ),
}));

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

vi.mock("date-fns", () => ({
  format: () => "FORMATTED_DATE",
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

/**
 * Builds a schedule row for tests; shallow-merges `pipeline` partials so overrides
 * may supply only `{ id, name }`.
 */
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
    nextRunAt: new Date(),
    pipelineId: "p1",
    retryConfig: null,
    executionConfig: null,
    priority: 0,
    enabled: true,
    lastRecoveredAt: null,
    lastMissedRunCount: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById: null,
    createdBy: null,
    ...scheduleOverrides,
  };
};

describe("ScheduleDetailContent", () => {
  it("renders back link to schedules list", () => {
    render(
      <ScheduleDetailContent
        schedule={createMockSchedule()}
        executionsSection={<div data-testid="executions-section" />}
        pipelines={[]}
        pipelineValidationById={{}}
      />,
    );
    const backLink = screen.getByRole("link", { name: /back to schedules/i });
    expect(backLink).toBeInTheDocument();
    expect(backLink).toHaveAttribute("href", "/dashboard/schedules");
  });

  it("renders schedule name and description", () => {
    render(
      <ScheduleDetailContent
        schedule={createMockSchedule()}
        executionsSection={<div data-testid="executions-section" />}
        pipelines={[]}
        pipelineValidationById={{}}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "Daily Run" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Runs every day")).toBeInTheDocument();
  });

  it("renders link to the schedule pipeline", () => {
    render(
      <ScheduleDetailContent
        schedule={createMockSchedule()}
        executionsSection={<div data-testid="executions-section" />}
        pipelines={[]}
        pipelineValidationById={{}}
      />,
    );
    const pipelineLink = screen.getByRole("link", { name: "Main" });
    expect(pipelineLink).toHaveAttribute("href", "/dashboard/pipelines/p1");
  });

  it("shows Enabled when the schedule is enabled", () => {
    render(
      <ScheduleDetailContent
        schedule={createMockSchedule({ enabled: true })}
        executionsSection={<div data-testid="executions-section" />}
        pipelines={[]}
        pipelineValidationById={{}}
      />,
    );
    expect(screen.getByText("Enabled")).toBeInTheDocument();
    expect(
      screen.getByLabelText("This schedule is enabled"),
    ).toBeInTheDocument();
  });

  it("shows Disabled when the schedule is disabled", () => {
    render(
      <ScheduleDetailContent
        schedule={createMockSchedule({ enabled: false })}
        executionsSection={<div data-testid="executions-section" />}
        pipelines={[]}
        pipelineValidationById={{}}
      />,
    );
    expect(screen.getByText("Disabled")).toBeInTheDocument();
    expect(
      screen.getByLabelText("This schedule is disabled"),
    ).toBeInTheDocument();
  });

  it("shows next run time when enabled and nextRunAt is set", () => {
    const nextRunAt = new Date("2026-03-22T12:00:00.000Z");
    render(
      <ScheduleDetailContent
        schedule={createMockSchedule({
          enabled: true,
          nextRunAt,
          timezone: "UTC",
        })}
        executionsSection={<div data-testid="executions-section" />}
        pipelines={[]}
        pipelineValidationById={{}}
      />,
    );
    const timeEl = screen.getByRole("time");
    expect(timeEl).toHaveAttribute("dateTime", nextRunAt.toISOString());
    expect(timeEl).toHaveTextContent("FORMATTED_DATE (UTC)");
    expect(screen.getByText("Next run:")).toBeInTheDocument();
  });

  it("shows none scheduled when enabled but nextRunAt is null", () => {
    render(
      <ScheduleDetailContent
        schedule={createMockSchedule({
          enabled: true,
          nextRunAt: null,
        })}
        executionsSection={<div data-testid="executions-section" />}
        pipelines={[]}
        pipelineValidationById={{}}
      />,
    );
    expect(screen.getByText("None scheduled")).toBeInTheDocument();
  });

  it("shows disabled next-run copy when schedule is disabled", () => {
    render(
      <ScheduleDetailContent
        schedule={createMockSchedule({
          enabled: false,
          nextRunAt: new Date(),
        })}
        executionsSection={<div data-testid="executions-section" />}
        pipelines={[]}
        pipelineValidationById={{}}
      />,
    );
    expect(screen.getByText("Not while disabled")).toBeInTheDocument();
  });

  it("renders Edit schedule button", () => {
    render(
      <ScheduleDetailContent
        schedule={createMockSchedule()}
        executionsSection={<div data-testid="executions-section" />}
        pipelines={[]}
        pipelineValidationById={{}}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Edit schedule" }),
    ).toBeInTheDocument();
  });

  it("opens edit modal when Edit schedule is clicked", () => {
    render(
      <ScheduleDetailContent
        schedule={createMockSchedule()}
        executionsSection={<div data-testid="executions-section" />}
        pipelines={[]}
        pipelineValidationById={{}}
      />,
    );
    const modal = screen.getByTestId("schedule-form-modal");
    expect(modal).toHaveAttribute("data-open", "false");
    fireEvent.click(screen.getByRole("button", { name: "Edit schedule" }));
    expect(modal).toHaveAttribute("data-open", "true");
    expect(modal).toHaveAttribute("data-mode", "edit");
    expect(modal).toHaveAttribute("data-edit-id", "sched-1");
  });

  it("renders the executions section under the Executions heading", () => {
    render(
      <ScheduleDetailContent
        schedule={createMockSchedule()}
        executionsSection={<div data-testid="executions-section" />}
        pipelines={[]}
        pipelineValidationById={{}}
      />,
    );
    const heading = screen.getByRole("heading", { name: "Executions" });
    const section = heading.closest("section") as HTMLElement;

    expect(
      within(section).getByTestId("executions-section"),
    ).toBeInTheDocument();
  });
});
