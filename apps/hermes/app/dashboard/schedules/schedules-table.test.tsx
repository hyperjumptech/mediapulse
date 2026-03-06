import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SchedulesTable } from "./schedules-table";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

vi.mock("@workspace/ui/components/table", () => ({
  Table: ({ children }: React.PropsWithChildren) => (
    <table data-testid="table">{children}</table>
  ),
  TableHeader: ({ children }: React.PropsWithChildren) => (
    <thead>{children}</thead>
  ),
  TableBody: ({ children }: React.PropsWithChildren) => (
    <tbody>{children}</tbody>
  ),
  TableRow: ({ children }: React.PropsWithChildren) => <tr>{children}</tr>,
  TableHead: ({ children }: React.PropsWithChildren) => <th>{children}</th>,
  TableCell: ({
    children,
    colSpan,
  }: React.PropsWithChildren<{ colSpan?: number }>) => (
    <td colSpan={colSpan}>{children}</td>
  ),
}));

vi.mock("./schedule-row-actions", () => ({
  ScheduleRowActions: ({
    scheduleId,
    scheduleName,
  }: {
    scheduleId: string;
    scheduleName: string;
  }) => (
    <button data-testid={`row-actions-${scheduleId}`} data-name={scheduleName}>
      Actions
    </button>
  ),
}));

const createMockSchedule = (
  overrides?: Partial<{
    id: string;
    name: string;
    repeat: string;
    enabled: boolean;
    nextRunAt: Date | null;
    pipeline: { name: string };
  }>,
) => ({
  id: "schedule-1",
  name: "Daily Run",
  repeat: "repeating",
  enabled: true,
  nextRunAt: new Date("2024-01-15T10:00:00Z"),
  pipeline: { name: "Test Pipeline" },
  createdAt: new Date("2024-01-01"),
  ...overrides,
});

describe("SchedulesTable", () => {
  it("renders table headers", () => {
    // Act
    render(
      <SchedulesTable
        schedules={[]}
        sortBy="name"
        sortDir="asc"
        pageSize={15}
        onEdit={vi.fn()}
      />,
    );

    // Assert
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Pipeline")).toBeInTheDocument();
    expect(screen.getByText("Repeat")).toBeInTheDocument();
    expect(screen.getByText("Next run")).toBeInTheDocument();
    expect(screen.getByText("Enabled")).toBeInTheDocument();
    expect(screen.getByText("Created")).toBeInTheDocument();
  });

  it("renders empty state when no schedules", () => {
    // Act
    render(
      <SchedulesTable
        schedules={[]}
        sortBy="name"
        sortDir="asc"
        pageSize={15}
        onEdit={vi.fn()}
      />,
    );

    // Assert
    expect(screen.getByText("No schedules yet.")).toBeInTheDocument();
  });

  it("renders schedule rows when schedules provided", () => {
    // Setup
    const schedules = [createMockSchedule()];

    // Act
    render(
      <SchedulesTable
        schedules={schedules}
        sortBy="name"
        sortDir="asc"
        pageSize={15}
        onEdit={vi.fn()}
      />,
    );

    // Assert
    expect(screen.getByText("Daily Run")).toBeInTheDocument();
    expect(screen.getByText("Test Pipeline")).toBeInTheDocument();
    expect(screen.getByText("repeating")).toBeInTheDocument();
  });

  it("displays Yes for enabled schedules", () => {
    // Setup
    const schedules = [createMockSchedule({ enabled: true })];

    // Act
    render(
      <SchedulesTable
        schedules={schedules}
        sortBy="name"
        sortDir="asc"
        pageSize={15}
        onEdit={vi.fn()}
      />,
    );

    // Assert
    expect(screen.getByText("Yes")).toBeInTheDocument();
  });

  it("displays No for disabled schedules", () => {
    // Setup
    const schedules = [createMockSchedule({ enabled: false })];

    // Act
    render(
      <SchedulesTable
        schedules={schedules}
        sortBy="name"
        sortDir="asc"
        pageSize={15}
        onEdit={vi.fn()}
      />,
    );

    // Assert
    expect(screen.getByText("No")).toBeInTheDocument();
  });

  it("displays dash for null nextRunAt", () => {
    // Setup
    const schedules = [createMockSchedule({ nextRunAt: null })];

    // Act
    render(
      <SchedulesTable
        schedules={schedules}
        sortBy="name"
        sortDir="asc"
        pageSize={15}
        onEdit={vi.fn()}
      />,
    );

    // Assert
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("calls onEdit when clicking schedule name", () => {
    // Setup
    const onEdit = vi.fn();
    const schedules = [createMockSchedule({ id: "schedule-123" })];

    // Act
    render(
      <SchedulesTable
        schedules={schedules}
        sortBy="name"
        sortDir="asc"
        pageSize={15}
        onEdit={onEdit}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Daily Run" }));

    // Assert
    expect(onEdit).toHaveBeenCalledWith("schedule-123");
  });

  it("renders row actions for each schedule", () => {
    // Setup
    const schedules = [
      createMockSchedule({ id: "schedule-1" }),
      createMockSchedule({ id: "schedule-2", name: "Weekly Run" }),
    ];

    // Act
    render(
      <SchedulesTable
        schedules={schedules}
        sortBy="name"
        sortDir="asc"
        pageSize={15}
        onEdit={vi.fn()}
      />,
    );

    // Assert
    expect(screen.getByTestId("row-actions-schedule-1")).toBeInTheDocument();
    expect(screen.getByTestId("row-actions-schedule-2")).toBeInTheDocument();
  });
});
