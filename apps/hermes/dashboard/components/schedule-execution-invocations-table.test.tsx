import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const fetchInvocationPayloadActionMock = vi.fn();

vi.mock("@/app/dashboard/executions/agent-activity-actions", () => ({
  fetchAgentActivitiesAction: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/app/dashboard/executions/invocation-payload-actions", () => ({
  fetchInvocationPayloadAction: (...args: unknown[]) =>
    fetchInvocationPayloadActionMock(...args),
}));

import { ScheduleExecutionInvocationsTable } from "./schedule-execution-invocations-table";
import type { InvocationPayloadSource } from "./use-schedule-execution-invocations-modal";

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

const payloadSource: InvocationPayloadSource = {
  kind: "httpTrigger",
  parentId: "trigger-1",
  executionId: "exec-1",
};

const failedInvocation = {
  jobId: "j1",
  status: "failed",
  semanticStatus: null,
  outcomeSummary: "err",
  agentId: "my-agent",
  startedAtIso: "2025-03-20T10:00:00.000Z",
  completedAtIso: "2025-03-20T10:00:05.000Z",
  dataQueueAttempts: null,
  dataQueueMaxAttempts: null,
};

describe("ScheduleExecutionInvocationsTable", () => {
  afterEach(() => {
    fetchInvocationPayloadActionMock.mockReset();
  });

  it("loads the clicked job's payload and shows its JSON in the modal", async () => {
    // Setup
    fetchInvocationPayloadActionMock.mockResolvedValue({
      inputMasked: { ticker: "ABC" },
      configMasked: { foo: 1 },
      transportError: { message: "err" },
      agentResponse: null,
    });

    // Act
    render(
      <ScheduleExecutionInvocationsTable
        invocations={[failedInvocation]}
        payloadSource={payloadSource}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "j1" }));

    // Assert
    const openDialogs = screen
      .getAllByTestId("dialog")
      .filter((node) => node.getAttribute("data-open") === "true");

    expect(openDialogs).toHaveLength(1);
    expect(
      screen.getByRole("status", { name: "Loading invocation details" }),
    ).toBeInTheDocument();
    expect(await screen.findByText(/"ticker": "ABC"/)).toBeInTheDocument();
    expect(screen.getByText(/"foo": 1/)).toBeInTheDocument();
    expect(screen.getByText("my-agent")).toBeInTheDocument();
    expect(fetchInvocationPayloadActionMock).toHaveBeenCalledWith({
      kind: "httpTrigger",
      parentId: "trigger-1",
      executionId: "exec-1",
      jobId: "j1",
    });
  });

  it("shows error text in the modal when the payload cannot be loaded", async () => {
    // Setup
    fetchInvocationPayloadActionMock.mockRejectedValue(new Error("boom"));

    // Act
    render(
      <ScheduleExecutionInvocationsTable
        invocations={[failedInvocation]}
        payloadSource={payloadSource}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "j1" }));

    // Assert
    expect(
      await screen.findByText(/could not load this invocation's details/i),
    ).toBeInTheDocument();
    expect(screen.queryByText("Input")).not.toBeInTheDocument();
  });

  it("renders empty state when there are no invocations", () => {
    // Act
    render(
      <ScheduleExecutionInvocationsTable
        invocations={[]}
        payloadSource={payloadSource}
      />,
    );

    // Assert
    expect(screen.getByText("No invocations.")).toBeInTheDocument();
    expect(fetchInvocationPayloadActionMock).not.toHaveBeenCalled();
  });

  it("shows sortable started/completed headers and collapses status to outcome", () => {
    // Setup
    const invocations = [
      {
        jobId: "job-a",
        status: "completed",
        semanticStatus: "success" as const,
        outcomeSummary: null,
        agentId: "alpha",
        startedAtIso: "2025-01-02T00:00:00.000Z",
        completedAtIso: "2025-01-02T00:01:00.000Z",
        dataQueueAttempts: 2,
        dataQueueMaxAttempts: 5,
      },
    ];

    // Act
    render(
      <ScheduleExecutionInvocationsTable
        invocations={invocations}
        payloadSource={payloadSource}
      />,
    );

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
