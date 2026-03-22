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
      },
    ];

    // Act
    render(<ScheduleExecutionInvocationsTable invocations={invocations} />);
    fireEvent.click(screen.getByRole("button", { name: "j1" }));

    // Assert
    expect(screen.getByTestId("dialog")).toHaveAttribute("data-open", "true");
    expect(screen.getByText(/"ticker": "ABC"/)).toBeInTheDocument();
    expect(screen.getByText(/"foo": 1/)).toBeInTheDocument();
  });

  it("renders empty state when there are no invocations", () => {
    // Act
    render(<ScheduleExecutionInvocationsTable invocations={[]} />);

    // Assert
    expect(screen.getByText("No invocations.")).toBeInTheDocument();
  });
});
