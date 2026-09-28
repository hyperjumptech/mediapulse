import React from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@workspace/ui/components/tooltip";

import {
  BreadcrumbEntityLabelsProvider,
  useBreadcrumbEntityLabels,
} from "@/components/breadcrumb-entity-label";
import type { ScheduleExecutionInvocationsTableProps } from "@/components/schedule-execution-invocations-table";

const invocationsTablePropsMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("@/components/schedule-execution-invocations-table", () => ({
  ScheduleExecutionInvocationsTable: (
    props: ScheduleExecutionInvocationsTableProps,
  ) => {
    invocationsTablePropsMock(props);

    return <div data-testid="invocations-stub" />;
  },
}));

import { ExecutionDetailView } from "./execution-detail-view";
import type { ExecutionDetailViewModel } from "./execution-detail-view-model";

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const buildViewModel = (
  overrides: Partial<ExecutionDetailViewModel> = {},
): ExecutionDetailViewModel => ({
  executionId: "exec-123",
  parent: { kind: "schedule", id: "sched-1", name: "Morning run" },
  sourceLabel: "Morning run",
  pipeline: { id: "pipe-1", name: "Daily digest" },
  runStatus: "succeeded",
  enqueueStatus: "success",
  executionTimeIso: "2026-09-28T10:00:00.000Z",
  elapsedLabel: "4s",
  jobsCreated: 3,
  jobsEnqueued: 2,
  succeededInvocationCount: 5,
  failedInvocationCount: 0,
  transport: {
    headline: "Hermes worker + DataQueue",
    detail: "Scheduled runs enqueue jobs on DataQueue.",
  },
  metadataHints: [],
  requestSnapshotJson: null,
  enqueueErrors: [],
  enqueueMetadata: null,
  steps: [
    {
      pipelineStepId: "step-1",
      stepOrder: 1,
      agentId: "summarizer",
      agentVersion: "1.2.0",
      expectedInvocationCount: 4,
      succeededCount: 3,
      failedCount: 1,
      rollupStatus: "partial",
    },
  ],
  invocations: [],
  canCancel: false,
  cancelTarget: {
    kind: "schedule",
    scheduleId: "sched-1",
    scheduleExecutionId: "exec-123",
  },
  payloadSource: {
    kind: "schedule",
    parentId: "sched-1",
    executionId: "exec-123",
  },
  processedUrlsHref: null,
  ...overrides,
});

const renderView = (viewModel: ExecutionDetailViewModel) =>
  render(
    <TooltipProvider>
      <ExecutionDetailView viewModel={viewModel} />
    </TooltipProvider>,
  );

const statCard = (label: string): HTMLElement => {
  const term = screen.getByText(label, { selector: "dt span" });
  const card = term.closest("[data-slot='card']");

  if (!(card instanceof HTMLElement)) {
    throw new Error(`No stat card for ${label}`);
  }

  return card;
};

const BreadcrumbLabelProbe = () => {
  const entityLabels = useBreadcrumbEntityLabels();

  return (
    <output data-testid="breadcrumb-labels">
      {JSON.stringify(Object.fromEntries(entityLabels))}
    </output>
  );
};

describe("ExecutionDetailView", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    invocationsTablePropsMock.mockReset();
  });

  it("renders the header with run status, source, pipeline link and execution id", () => {
    // Act
    renderView(buildViewModel());

    // Assert
    const heading = screen.getByRole("heading", { level: 1 });
    const pipelineLink = screen.getByRole("link", { name: "Daily digest" });

    expect(heading).toHaveTextContent("Execution");
    expect(screen.getByText(/Morning run/)).toBeInTheDocument();
    expect(pipelineLink).toHaveAttribute("href", "/dashboard/pipelines/pipe-1");
    expect(screen.getByText("exec-123")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Copy execution ID" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Back to/)).not.toBeInTheDocument();
  });

  it("renders the summary stats from the view model", () => {
    // Act
    renderView(buildViewModel({ failedInvocationCount: 2 }));

    // Assert
    const failedCount = within(statCard("Invocations")).getByText("2");

    expect(within(statCard("Run status")).getByText("succeeded")).toBeVisible();
    expect(
      within(statCard("Enqueue status")).getByText("success"),
    ).toBeVisible();
    expect(within(statCard("Started")).getByText("Elapsed 4s")).toBeVisible();
    expect(statCard("Jobs")).toHaveTextContent("3 / 2");
    expect(statCard("Invocations")).toHaveTextContent("5 / 2");
    expect(failedCount).toHaveAttribute("data-failed", "true");
    expect(failedCount).toHaveClass("text-destructive");
    expect(statCard("Invocation transport")).toHaveTextContent(
      "Hermes worker + DataQueue",
    );
  });

  it("keeps the failed invocation count muted when nothing failed", () => {
    // Act
    renderView(buildViewModel());

    // Assert
    const failedCount = within(statCard("Invocations")).getByText("0");

    expect(failedCount).toHaveAttribute("data-failed", "false");
    expect(failedCount).not.toHaveClass("text-destructive");
  });

  it("reveals the invocation transport detail in a tooltip", async () => {
    // Setup
    renderView(buildViewModel());
    const trigger = screen.getByRole("button", {
      name: "About invocation transport",
    });

    // Act
    await act(async () => {
      fireEvent.focus(trigger);
    });

    // Assert
    expect(screen.getByRole("tooltip")).toHaveTextContent(
      "Scheduled runs enqueue jobs on DataQueue.",
    );
  });

  it("shows the cancel button and processed URLs link when they apply", () => {
    // Act
    renderView(
      buildViewModel({
        runStatus: "running",
        canCancel: true,
        processedUrlsHref:
          "/dashboard/schedules/sched-1/executions/exec-123/processed-urls",
      }),
    );

    // Assert
    expect(screen.getByRole("button", { name: "Cancel run" })).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Processed URLs" }),
    ).toHaveAttribute(
      "href",
      "/dashboard/schedules/sched-1/executions/exec-123/processed-urls",
    );
  });

  it("omits the header actions for a finished run without processed URLs", () => {
    // Act
    const { container } = renderView(buildViewModel());

    // Assert
    expect(
      screen.queryByRole("button", { name: "Cancel run" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Processed URLs" }),
    ).not.toBeInTheDocument();
    expect(
      container.querySelector('[data-slot="page-header-actions"]'),
    ).toBeNull();
  });

  it("renders pipeline steps with agent version and rollup status", () => {
    // Act
    renderView(buildViewModel());

    // Assert
    const section = screen.getByRole("region", { name: "Pipeline steps" });
    const row = within(section).getAllByRole("row")[1];

    if (!row) {
      throw new Error("Missing pipeline step row");
    }

    const cellTexts = within(row)
      .getAllByRole("cell")
      .map((cell) => cell.textContent);

    expect(cellTexts).toEqual([
      "1",
      "summarizer@1.2.0",
      "partial",
      "3",
      "1",
      "4",
    ]);
  });

  it("shows empty states and hides diagnostics when there is nothing to show", () => {
    // Act
    renderView(buildViewModel({ steps: [] }));

    // Assert
    expect(screen.getByText("No pipeline steps ran")).toBeVisible();
    expect(
      screen.queryByRole("region", { name: /enqueue diagnostics/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Request snapshot" }),
    ).not.toBeInTheDocument();
  });

  it("renders enqueue diagnostics for a failed enqueue", () => {
    // Act
    renderView(
      buildViewModel({
        enqueueStatus: "failed",
        enqueueErrors: [
          { message: "ENQUEUE_BOOM", timestamp: "2026-09-28T10:00:01.000Z" },
        ],
      }),
    );

    // Assert
    const region = screen.getByRole("region", { name: /enqueue diagnostics/i });

    expect(within(region).getByText("ENQUEUE_BOOM")).toBeVisible();
  });

  it("renders the request snapshot and metadata hints when present", () => {
    // Act
    renderView(
      buildViewModel({
        requestSnapshotJson: '{\n  "method": "POST"\n}',
        metadataHints: ["Request id: req-9"],
      }),
    );

    // Assert
    const snapshot = screen.getByRole("region", { name: "Request snapshot" });

    expect(within(snapshot).getByText(/"method": "POST"/)).toBeVisible();
    expect(screen.getByText("Request id: req-9")).toBeVisible();
  });

  it("passes invocation rows and the payload scope to the invocations table", () => {
    // Setup
    const invocations = [
      {
        jobId: "job-1",
        status: "completed",
        semanticStatus: "success",
        outcomeSummary: null,
        agentId: "summarizer",
        startedAtIso: null,
        completedAtIso: null,
        dataQueueAttempts: null,
        dataQueueMaxAttempts: null,
      },
    ];

    // Act
    renderView(buildViewModel({ invocations }));

    // Assert
    expect(invocationsTablePropsMock).toHaveBeenCalledWith({
      invocations,
      payloadSource: {
        kind: "schedule",
        parentId: "sched-1",
        executionId: "exec-123",
      },
    });
    expect(
      screen.getByRole("region", { name: "Invocations" }),
    ).toHaveTextContent("1");
  });

  it("publishes the parent name for the breadcrumbs", () => {
    // Act
    render(
      <BreadcrumbEntityLabelsProvider>
        <TooltipProvider>
          <ExecutionDetailView viewModel={buildViewModel()} />
        </TooltipProvider>
        <BreadcrumbLabelProbe />
      </BreadcrumbEntityLabelsProvider>,
    );

    // Assert
    expect(screen.getByTestId("breadcrumb-labels")).toHaveTextContent(
      '{"sched-1":"Morning run"}',
    );
  });
});
