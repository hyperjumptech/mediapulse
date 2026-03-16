import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
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

vi.mock("./executions-table", () => ({
  ExecutionsTable: ({ executions }: { executions: unknown[] }) => (
    <div data-testid="executions-table" data-count={executions.length} />
  ),
}));

vi.mock("@/components/list-pagination", () => ({
  ListPagination: ({
    basePath,
    page,
    total,
  }: {
    basePath: string;
    page: number;
    total: number;
  }) => (
    <nav
      data-testid="executions-pagination"
      data-base-path={basePath}
      data-page={page}
      data-total={total}
    />
  ),
}));

const createMockSchedule = (): ScheduleDetailContentProps["schedule"] =>
  ({
    id: "sched-1",
    name: "Daily Run",
    description: "Runs every day",
    pipeline: { id: "p1", name: "Main" },
    repeat: "repeating",
    cronExpression: "0 6 * * *",
    interval: null,
    timezone: "UTC",
    startAt: null,
    nextRunAt: new Date(),
    pipelineId: "p1",
    retryConfig: null,
    timeout: null,
    priority: 0,
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: null,
  }) as unknown as ScheduleDetailContentProps["schedule"];

const createMockExecution = () => ({
  id: "ex-1",
  executionTime: new Date("2025-01-15T10:00:00Z"),
  status: "success",
  jobsCreated: 2,
  jobsEnqueued: 2,
  errors: null,
  createdAt: new Date(),
});

describe("ScheduleDetailContent", () => {
  it("renders back link to schedules list", () => {
    render(
      <ScheduleDetailContent
        schedule={createMockSchedule()}
        executions={[]}
        totalExecutions={0}
        currentPage={1}
        pageSize={15}
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
        executions={[]}
        totalExecutions={0}
        currentPage={1}
        pageSize={15}
        pipelines={[]}
        pipelineValidationById={{}}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "Daily Run" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Runs every day")).toBeInTheDocument();
  });

  it("renders Edit schedule button", () => {
    render(
      <ScheduleDetailContent
        schedule={createMockSchedule()}
        executions={[]}
        totalExecutions={0}
        currentPage={1}
        pageSize={15}
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
        executions={[]}
        totalExecutions={0}
        currentPage={1}
        pageSize={15}
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

  it("renders Executions section with table and pagination", () => {
    const executions = [createMockExecution()];
    render(
      <ScheduleDetailContent
        schedule={createMockSchedule()}
        executions={executions}
        totalExecutions={1}
        currentPage={1}
        pageSize={15}
        pipelines={[]}
        pipelineValidationById={{}}
      />,
    );
    expect(screen.getByText("Executions")).toBeInTheDocument();
    expect(screen.getByTestId("executions-table")).toHaveAttribute(
      "data-count",
      "1",
    );
    expect(screen.getByTestId("executions-pagination")).toBeInTheDocument();
  });
});
