import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ScheduleExecutionInvocationsTable } from "./schedule-execution-invocations-table";

vi.mock("@workspace/ui/components/dialog", () => ({
  Dialog: ({
    children,
    open,
  }: React.PropsWithChildren<{
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
  }>) => (
    <div data-testid="dialog" data-open={open}>
      {children}
    </div>
  ),
  DialogContent: ({ children }: React.PropsWithChildren) => (
    <div data-testid="dialog-content">{children}</div>
  ),
  DialogHeader: ({ children }: React.PropsWithChildren) => (
    <div data-testid="dialog-header">{children}</div>
  ),
  DialogTitle: ({ children }: React.PropsWithChildren) => (
    <h2 data-testid="dialog-title">{children}</h2>
  ),
}));

describe("ScheduleExecutionInvocationsTable", () => {
  it("opens the modal with JSON when a job id is clicked", () => {
    // Setup
    const invocations = [
      {
        jobId: "j1",
        status: "failed",
        semanticStatus: null,
        errorSummary: "err",
        inputMasked: { ticker: "ABC" },
        configMasked: { foo: 1 },
        agentId: "my-agent",
        startedAtIso: "2025-03-20T10:00:00.000Z",
        completedAtIso: "2025-03-20T10:00:05.000Z",
        dataQueueAttempts: null,
        dataQueueMaxAttempts: null,
      },
    ];

    // Act
    render(<ScheduleExecutionInvocationsTable invocations={invocations} />);
    fireEvent.click(screen.getByRole("button", { name: "j1" }));

    // Assert
    expect(screen.getByTestId("dialog")).toHaveAttribute("data-open", "true");
    expect(screen.getByText(/"ticker": "ABC"/)).toBeInTheDocument();
    expect(screen.getByText(/"foo": 1/)).toBeInTheDocument();
    expect(screen.getByText("my-agent")).toBeInTheDocument();
  });

  it("renders empty state when there are no invocations", () => {
    // Act
    render(<ScheduleExecutionInvocationsTable invocations={[]} />);

    // Assert
    expect(screen.getByText("No invocations.")).toBeInTheDocument();
  });

  it("shows sortable started/completed headers and collapses status to outcome", () => {
    // Setup
    const invocations = [
      {
        jobId: "job-a",
        status: "completed",
        semanticStatus: "success" as const,
        errorSummary: null,
        inputMasked: {},
        configMasked: null,
        agentId: "alpha",
        startedAtIso: "2025-01-02T00:00:00.000Z",
        completedAtIso: "2025-01-02T00:01:00.000Z",
        dataQueueAttempts: 2,
        dataQueueMaxAttempts: 5,
      },
    ];

    // Act
    render(<ScheduleExecutionInvocationsTable invocations={invocations} />);

    // Assert
    expect(
      screen.getByRole("button", { name: /Started at/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Completed at/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("success")).toBeInTheDocument();
    expect(screen.queryByText("Semantic")).not.toBeInTheDocument();
    expect(screen.getByText("2 / 5")).toBeInTheDocument();
  });
});
