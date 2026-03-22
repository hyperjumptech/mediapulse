import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ExecutionsTable } from "./executions-table";
import type { ScheduleExecutionRow } from "@/lib/schedules";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...rest
  }: React.PropsWithChildren<
    { href: string } & React.AnchorHTMLAttributes<HTMLAnchorElement>
  >) => (
    <a href={href} {...rest}>
      {children}
    </a>
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
    expect(
      screen.getByText("Invocations (success / fail)"),
    ).toBeInTheDocument();
    expect(screen.getByText("Detail")).toBeInTheDocument();
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

  it("links execution time and detail to the execution page", () => {
    const executions = [createMockExecution({ id: "ex-99" })];
    render(<ExecutionsTable scheduleId="sched-1" executions={executions} />);
    const links = screen.getAllByRole("link", {
      name: /open execution detail/i,
    });
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute(
      "href",
      "/dashboard/schedules/sched-1/executions/ex-99",
    );
    const viewLink = screen.getByRole("link", { name: "View" });
    expect(viewLink).toHaveAttribute(
      "href",
      "/dashboard/schedules/sched-1/executions/ex-99",
    );
  });
});
