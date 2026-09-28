import React from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
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

const desktopTable = () => screen.getByRole("table");

const openDetailButton = (agentId: string) =>
  within(desktopTable()).getByRole("button", {
    name: `Open invocation details for ${agentId}`,
  });

const bodyAgentIds = (): string[] =>
  within(desktopTable())
    .getAllByRole("row")
    .slice(1)
    .map((row) => {
      const agentCell = within(row).getAllByRole("cell")[0];

      return (agentCell?.textContent ?? "").replace(
        "Open invocation details for ",
        "",
      );
    });

const openMenu = async (trigger: HTMLElement) => {
  await act(async () => {
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
  });
};

describe("ScheduleExecutionInvocationsTable", () => {
  afterEach(() => {
    fetchInvocationPayloadActionMock.mockReset();
    fetchAgentActivitiesActionMock.mockReset();
    document.cookie = "hermes_dt_execution-invocations=; path=/; max-age=0";
  });

  it("loads the clicked invocation's payload and shows it across the dialog tabs", async () => {
    fetchInvocationPayloadActionMock.mockResolvedValue({
      inputMasked: { ticker: "ABC" },
      configMasked: { foo: 1 },
      transportError: { message: "transport exploded" },
      agentResponse: null,
    });
    renderTable([failedInvocation]);

    fireEvent.click(openDetailButton("my-agent"));

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

    fireEvent.mouseDown(within(dialog).getByRole("tab", { name: "Input" }));

    expect(within(dialog).getByText(/"ticker": "ABC"/)).toBeInTheDocument();

    fireEvent.mouseDown(within(dialog).getByRole("tab", { name: "Config" }));

    expect(within(dialog).getByText(/"foo": 1/)).toBeInTheDocument();
  });

  it("explains a missing config on the Config tab", async () => {
    fetchInvocationPayloadActionMock.mockResolvedValue({
      inputMasked: { ticker: "ABC" },
      configMasked: null,
      transportError: null,
      agentResponse: null,
    });
    renderTable([failedInvocation]);
    fireEvent.click(openDetailButton("my-agent"));
    const configTab = await screen.findByRole("tab", { name: "Config" });

    fireEvent.mouseDown(configTab);

    expect(
      screen.getByText(/No config stored for this invocation/),
    ).toBeVisible();
  });

  it("shows error text in the modal when the payload cannot be loaded", async () => {
    fetchInvocationPayloadActionMock.mockRejectedValue(new Error("boom"));
    renderTable([failedInvocation]);

    fireEvent.click(openDetailButton("my-agent"));

    expect(
      await screen.findByText(/could not load this invocation's details/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("tab", { name: "Input" }),
    ).not.toBeInTheDocument();
  });

  it("opens the activity dialog without opening the detail dialog", async () => {
    fetchAgentActivitiesActionMock.mockResolvedValue([]);
    renderTable([failedInvocation]);

    fireEvent.click(
      within(desktopTable()).getByRole("button", { name: "Activity" }),
    );

    expect(await screen.findByText("No activity recorded.")).toBeVisible();
    expect(screen.getByText("Activity for j1…")).toBeVisible();
    expect(fetchAgentActivitiesActionMock).toHaveBeenCalledWith("j1");
    expect(fetchInvocationPayloadActionMock).not.toHaveBeenCalled();
  });

  it("renders an empty state when there are no invocations", () => {
    renderTable([]);

    expect(screen.getByText("No invocations")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(fetchInvocationPayloadActionMock).not.toHaveBeenCalled();
  });

  it("shows agent, status, attempts, start, duration and outcome, with the job UUID hidden", () => {
    renderTable([failedInvocation]);

    const headers = within(desktopTable())
      .getAllByRole("columnheader")
      .map((header) => header.textContent);

    expect(headers).toEqual([
      "Agent",
      "Status",
      "Attempts",
      "Started",
      "Duration",
      "Outcome",
      "Activity",
    ]);
  });

  it("shows the job UUID once it is turned on", async () => {
    renderTable([failedInvocation]);

    await openMenu(screen.getByRole("button", { name: "Customize columns" }));
    await act(async () => {
      fireEvent.click(
        screen.getByRole("menuitemcheckbox", { name: "Job UUID" }),
      );
    });

    expect(
      within(screen.getByRole("table", { hidden: true })).getByRole("button", {
        name: "Copy job UUID j1",
        hidden: true,
      }),
    ).toBeInTheDocument();
  });

  it("collapses status into one outcome badge and shows attempts", () => {
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

    renderTable([invocation]);

    const table = desktopTable();
    const badge = within(table).getByText("success");

    expect(badge).toHaveAttribute("data-tone", "success");
    expect(within(table).queryByText("Semantic")).not.toBeInTheDocument();
    expect(within(table).getByText("2 / 5")).toBeInTheDocument();
    expect(within(table).getByText("1m")).toBeInTheDocument();
  });

  it("truncates the outcome summary and keeps the full text in its title", () => {
    const longSummary = "Partial: 3 of 5 sources failed to fetch in time";

    renderTable([{ ...failedInvocation, outcomeSummary: longSummary }]);

    const summary = within(desktopTable()).getByText(longSummary);

    expect(summary).toHaveClass("truncate");
    expect(summary).toHaveAttribute("title", longSummary);
  });

  it("starts in started order with unstarted jobs last and flips from the header menu", async () => {
    const earlier: ScheduleExecutionInvocationRow = {
      ...failedInvocation,
      jobId: "job-earlier",
      agentId: "agent-earlier",
      startedAtIso: "2025-03-20T09:00:00.000Z",
    };
    const later: ScheduleExecutionInvocationRow = {
      ...failedInvocation,
      jobId: "job-later",
      agentId: "agent-later",
      startedAtIso: "2025-03-20T11:00:00.000Z",
    };
    const queued: ScheduleExecutionInvocationRow = {
      ...failedInvocation,
      jobId: "job-queued",
      agentId: "agent-queued",
      startedAtIso: null,
      completedAtIso: null,
    };
    renderTable([queued, later, earlier]);

    const startedHeader = within(desktopTable()).getByRole("columnheader", {
      name: "Started",
    });

    expect(startedHeader).toHaveAttribute("aria-sort", "ascending");
    expect(bodyAgentIds()).toEqual([
      "agent-earlier",
      "agent-later",
      "agent-queued",
    ]);

    await openMenu(
      within(desktopTable()).getByRole("button", { name: "Started" }),
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("menuitem", { name: "Desc" }));
    });

    expect(startedHeader).toHaveAttribute("aria-sort", "descending");
    expect(bodyAgentIds()).toEqual([
      "agent-later",
      "agent-earlier",
      "agent-queued",
    ]);
  });
});
