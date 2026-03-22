import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ExecutionsTable } from "./executions-table";
import type { ScheduleExecutionRow } from "@/lib/schedules";

vi.mock("next/link", () => ({
  default: ({ children, href }: React.PropsWithChildren<{ href: string }>) => (
    <a href={href}>{children}</a>
  ),
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

vi.mock("@workspace/ui/components/button", () => ({
  Button: ({
    children,
    onClick,
  }: React.PropsWithChildren<{ onClick?: () => void }>) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
}));

vi.mock("./error-log-modal", () => ({
  ErrorLogModal: ({
    open,
    onOpenChange,
    errors,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    errors: unknown;
  }) => (
    <div
      data-testid="error-log-modal"
      data-open={open}
      data-errors={JSON.stringify(errors)}
    >
      <button type="button" onClick={() => onOpenChange(false)}>
        Close
      </button>
    </div>
  ),
}));

vi.mock("date-fns", () => ({
  format: (d: Date) => d.toISOString(),
}));

const createMockExecution = (
  overrides?: Partial<ScheduleExecutionRow>,
): ScheduleExecutionRow => ({
  id: "ex-1",
  executionTime: new Date("2025-01-15T10:00:00Z"),
  enqueueStatus: "success",
  runStatus: "succeeded",
  jobsCreated: 2,
  jobsEnqueued: 2,
  succeededInvocationCount: 2,
  failedInvocationCount: 0,
  errors: null,
  createdAt: new Date(),
  ...overrides,
});

describe("ExecutionsTable", () => {
  it("renders table headers", () => {
    render(<ExecutionsTable scheduleId="sched-1" executions={[]} />);
    expect(screen.getByText("Execution time")).toBeInTheDocument();
    expect(screen.getByText("Enqueue")).toBeInTheDocument();
    expect(screen.getByText("Run")).toBeInTheDocument();
    expect(screen.getByText("Jobs")).toBeInTheDocument();
    expect(screen.getByText("Error log")).toBeInTheDocument();
  });

  it("renders empty state when no executions", () => {
    render(<ExecutionsTable scheduleId="sched-1" executions={[]} />);
    expect(screen.getByText("No executions yet.")).toBeInTheDocument();
  });

  it("renders execution rows", () => {
    const executions = [
      createMockExecution({
        id: "ex-1",
        enqueueStatus: "success",
        runStatus: "running",
        jobsCreated: 3,
        jobsEnqueued: 3,
      }),
    ];
    render(<ExecutionsTable scheduleId="sched-1" executions={executions} />);
    expect(screen.getByText("success")).toBeInTheDocument();
    expect(screen.getByText("running")).toBeInTheDocument();
  });

  it("shows View log button when execution has errors", () => {
    const executions = [
      createMockExecution({
        id: "ex-1",
        errors: [
          { message: "Something failed", timestamp: "2025-01-15T10:00:00Z" },
        ],
      }),
    ];
    render(<ExecutionsTable scheduleId="sched-1" executions={executions} />);
    const viewLogBtn = screen.getByRole("button", { name: "View log" });
    expect(viewLogBtn).toBeInTheDocument();
  });

  it("shows dash when execution has no errors", () => {
    render(
      <ExecutionsTable
        scheduleId="sched-1"
        executions={[createMockExecution()]}
      />,
    );
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("opens error log modal when View log is clicked", () => {
    const errors = [{ message: "Error", timestamp: "2025-01-15" }];
    const executions = [createMockExecution({ id: "ex-1", errors })];
    render(<ExecutionsTable scheduleId="sched-1" executions={executions} />);
    expect(screen.getByTestId("error-log-modal")).toHaveAttribute(
      "data-open",
      "false",
    );
    fireEvent.click(screen.getByRole("button", { name: "View log" }));
    expect(screen.getByTestId("error-log-modal")).toHaveAttribute(
      "data-open",
      "true",
    );
  });
});
