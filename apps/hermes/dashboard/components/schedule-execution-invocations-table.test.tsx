import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const fetchInvocationPayloadActionMock = vi.fn();
const fetchAgentActivitiesActionMock = vi.fn();

vi.mock("@/app/dashboard/executions/agent-activity-actions", () => ({
  fetchAgentActivitiesAction: (...args: unknown[]) =>
    fetchAgentActivitiesActionMock(...args),
}));

vi.mock("@/app/dashboard/executions/invocation-payload-actions", () => ({
  fetchInvocationPayloadAction: (...args: unknown[]) =>
    fetchInvocationPayloadActionMock(...args),
}));

vi.mock("@workspace/ui/components/dialog", () => ({
  Dialog: ({
    children,
    open,
  }: React.PropsWithChildren<{
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
  }>) => (open ? <div data-testid="dialog">{children}</div> : null),
  DialogContent: ({ children }: React.PropsWithChildren) => (
    <div data-testid="dialog-content">{children}</div>
  ),
  DialogHeader: ({ children }: React.PropsWithChildren) => (
    <div data-testid="dialog-header">{children}</div>
  ),
  DialogTitle: ({ children }: React.PropsWithChildren) => (
    <h2 data-testid="dialog-title">{children}</h2>
  ),
  DialogDescription: ({ children }: React.PropsWithChildren) => (
    <p data-testid="dialog-description">{children}</p>
  ),
}));

import { ScheduleExecutionInvocationsTable } from "./schedule-execution-invocations-table";
import type {
  InvocationPayloadSource,
  ScheduleExecutionInvocationRow,
} from "./use-schedule-execution-invocations-modal";

const payloadSource: InvocationPayloadSource = {
  kind: "httpTrigger",
  parentId: "trigger-1",
  executionId: "exec-1",
};

const failedInvocation: ScheduleExecutionInvocationRow = {
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

const renderTable = (invocations: ScheduleExecutionInvocationRow[]) =>
  render(
    <ScheduleExecutionInvocationsTable
      invocations={invocations}
      payloadSource={payloadSource}
    />,
  );

const bodyJobIds = (): string[] => {
  const rows = screen.getAllByRole("row").slice(1);

  return rows.map((row) => {
    const firstCell = within(row).getAllByRole("cell")[0];

    return firstCell?.textContent ?? "";
  });
};

describe("ScheduleExecutionInvocationsTable", () => {
  afterEach(() => {
    fetchInvocationPayloadActionMock.mockReset();
    fetchAgentActivitiesActionMock.mockReset();
  });

  it("loads the clicked job's payload and shows it across the dialog tabs", async () => {
    // Setup
    fetchInvocationPayloadActionMock.mockResolvedValue({
      inputMasked: { ticker: "ABC" },
      configMasked: { foo: 1 },
      transportError: { message: "transport exploded" },
      agentResponse: null,
    });
    renderTable([failedInvocation]);

    // Act
    fireEvent.click(screen.getByRole("button", { name: "j1" }));

    // Assert
    const dialog = screen.getByTestId("dialog");

    expect(
      within(dialog).getByRole("status", {
        name: "Loading invocation details",
      }),
    ).toBeInTheDocument();
    expect(
      await within(dialog).findByText("Transport error"),
    ).toBeInTheDocument();
    expect(within(dialog).getByText("my-agent")).toBeInTheDocument();
    expect(within(dialog).getByText("failure")).toBeInTheDocument();
    expect(fetchInvocationPayloadActionMock).toHaveBeenCalledTimes(1);
    expect(fetchInvocationPayloadActionMock).toHaveBeenCalledWith({
      kind: "httpTrigger",
      parentId: "trigger-1",
      executionId: "exec-1",
      jobId: "j1",
    });

    // Act
    fireEvent.mouseDown(within(dialog).getByRole("tab", { name: "Input" }));

    // Assert
    expect(within(dialog).getByText(/"ticker": "ABC"/)).toBeInTheDocument();

    // Act
    fireEvent.mouseDown(within(dialog).getByRole("tab", { name: "Config" }));

    // Assert
    expect(within(dialog).getByText(/"foo": 1/)).toBeInTheDocument();
  });

  it("explains a missing config on the Config tab", async () => {
    // Setup
    fetchInvocationPayloadActionMock.mockResolvedValue({
      inputMasked: { ticker: "ABC" },
      configMasked: null,
      transportError: null,
      agentResponse: null,
    });
    renderTable([failedInvocation]);
    fireEvent.click(screen.getByRole("button", { name: "j1" }));
    const configTab = await screen.findByRole("tab", { name: "Config" });

    // Act
    fireEvent.mouseDown(configTab);

    // Assert
    expect(
      screen.getByText(/No config stored for this invocation/),
    ).toBeVisible();
  });

  it("opens the detail dialog when the row itself is clicked", async () => {
    // Setup
    fetchInvocationPayloadActionMock.mockResolvedValue(null);
    renderTable([failedInvocation]);

    // Act
    fireEvent.click(screen.getByText("err"));

    // Assert
    expect(await screen.findByText(/no longer available/i)).toBeInTheDocument();
    expect(fetchInvocationPayloadActionMock).toHaveBeenCalledTimes(1);
  });

  it("shows error text in the modal when the payload cannot be loaded", async () => {
    // Setup
    fetchInvocationPayloadActionMock.mockRejectedValue(new Error("boom"));
    renderTable([failedInvocation]);

    // Act
    fireEvent.click(screen.getByRole("button", { name: "j1" }));

    // Assert
    expect(
      await screen.findByText(/could not load this invocation's details/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("tab", { name: "Input" }),
    ).not.toBeInTheDocument();
  });

  it("opens the activity dialog without opening the detail dialog", async () => {
    // Setup
    fetchAgentActivitiesActionMock.mockResolvedValue([]);
    renderTable([failedInvocation]);

    // Act
    fireEvent.click(screen.getByRole("button", { name: "Activity" }));

    // Assert
    expect(await screen.findByText("No activity recorded.")).toBeVisible();
    expect(screen.getByText("Activity for j1…")).toBeVisible();
    expect(fetchAgentActivitiesActionMock).toHaveBeenCalledWith("j1");
    expect(fetchInvocationPayloadActionMock).not.toHaveBeenCalled();
  });

  it("renders an empty state when there are no invocations", () => {
    // Act
    renderTable([]);

    // Assert
    expect(screen.getByText("No invocations")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(fetchInvocationPayloadActionMock).not.toHaveBeenCalled();
  });

  it("collapses status into one outcome badge and shows attempts", () => {
    // Setup
    const invocation: ScheduleExecutionInvocationRow = {
      jobId: "job-a",
      status: "completed",
      semanticStatus: "success",
      outcomeSummary: null,
      agentId: "alpha",
      startedAtIso: "2025-01-02T00:00:00.000Z",
      completedAtIso: "2025-01-02T00:01:00.000Z",
      dataQueueAttempts: 2,
      dataQueueMaxAttempts: 5,
    };

    // Act
    renderTable([invocation]);

    // Assert
    const badge = screen.getByText("success");

    expect(badge).toHaveAttribute("data-tone", "success");
    expect(screen.queryByText("Semantic")).not.toBeInTheDocument();
    expect(screen.getByText("2 / 5")).toBeInTheDocument();
    expect(screen.getByText("1m")).toBeInTheDocument();
  });

  it("truncates the outcome summary and keeps the full text in its title", () => {
    // Setup
    const longSummary = "Partial: 3 of 5 sources failed to fetch in time";

    // Act
    renderTable([{ ...failedInvocation, outcomeSummary: longSummary }]);

    // Assert
    const summary = screen.getByText(longSummary);

    expect(summary).toHaveClass("truncate");
    expect(summary).toHaveAttribute("title", longSummary);
  });

  it("sorts by started time and toggles the direction", () => {
    // Setup
    const earlier: ScheduleExecutionInvocationRow = {
      ...failedInvocation,
      jobId: "job-earlier",
      startedAtIso: "2025-03-20T09:00:00.000Z",
    };
    const later: ScheduleExecutionInvocationRow = {
      ...failedInvocation,
      jobId: "job-later",
      startedAtIso: "2025-03-20T11:00:00.000Z",
    };
    renderTable([later, earlier]);

    // Assert
    const startedHeader = screen.getByRole("columnheader", { name: /Started/ });

    expect(startedHeader).toHaveAttribute("aria-sort", "ascending");
    expect(bodyJobIds()).toEqual(["job-earlier", "job-later"]);

    // Act
    fireEvent.click(screen.getByRole("button", { name: /Started/ }));

    // Assert
    expect(startedHeader).toHaveAttribute("aria-sort", "descending");
    expect(bodyJobIds()).toEqual(["job-later", "job-earlier"]);
    expect(
      screen.getByRole("columnheader", { name: /Completed/ }),
    ).not.toHaveAttribute("aria-sort");
  });
});
