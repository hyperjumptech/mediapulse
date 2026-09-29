import React from "react";
import { render, screen, within } from "@testing-library/react";
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

vi.mock("./execution-invocations-table-section", () => ({
  ExecutionInvocationsTableSection: (
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
  sourceLabel: null,
  pipeline: { id: "pipe-1", name: "Daily digest" },
  runStatus: "succeeded",
  enqueueStatus: "success",
  executionTimeIso: "2026-09-28T10:00:00.000Z",
  elapsedLabel: "4s",
  succeededInvocationCount: 5,
  failedInvocationCount: 0,
  expectedInvocationCount: 6,
  metadataHints: [],
  requestSnapshotJson: null,
  runParamsJson: null,
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
  const card = term.closest("[data-slot='stat-tile']");

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

  it("renders the header with run status, pipeline link and execution id", () => {
    renderView(buildViewModel());

    const pipelineLink = screen.getByRole("link", { name: "Daily digest" });

    expect(pipelineLink).toHaveAttribute("href", "/dashboard/pipelines/pipe-1");
    expect(screen.getByText("exec-123")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Copy execution ID" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Morning run")).not.toBeInTheDocument();
  });

  it("names a manual run in the header", () => {
    renderView(buildViewModel({ sourceLabel: "Manual run", pipeline: null }));

    expect(screen.getByText("Manual run")).toBeVisible();
    expect(screen.queryByRole("link", { name: "Daily digest" })).toBeNull();
  });

  it("shows when it started, how long it took and how many invocations passed or failed", () => {
    renderView(buildViewModel({ failedInvocationCount: 2 }));

    expect(statCard("Duration")).toHaveTextContent("4s");
    expect(statCard("Succeeded")).toHaveTextContent("5of 6 expected");
    expect(within(statCard("Failed")).getByText("2")).toHaveClass(
      "text-destructive",
    );
    expect(screen.queryByText("Run status")).not.toBeInTheDocument();
    expect(screen.queryByText("Invocation transport")).not.toBeInTheDocument();
  });

  it("keeps the failed invocation count muted when nothing failed", () => {
    renderView(buildViewModel());

    const failedCount = within(statCard("Failed")).getByText("0");

    expect(failedCount).toHaveClass("text-muted-foreground");
    expect(failedCount).not.toHaveClass("text-destructive");
  });

  it("shows the cancel button and processed URLs link when they apply", () => {
    renderView(
      buildViewModel({
        runStatus: "running",
        canCancel: true,
        processedUrlsHref:
          "/dashboard/schedules/sched-1/executions/exec-123/processed-urls",
      }),
    );

    expect(screen.getByRole("button", { name: "Cancel run" })).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Processed URLs" }),
    ).toHaveAttribute(
      "href",
      "/dashboard/schedules/sched-1/executions/exec-123/processed-urls",
    );
  });

  it("omits the header actions for a finished run without processed URLs", () => {
    const { container } = renderView(buildViewModel());

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
    renderView(buildViewModel());

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
      "3 / 4",
      "1",
    ]);
  });

  it("shows empty states and hides diagnostics when there is nothing to show", () => {
    renderView(buildViewModel({ steps: [] }));

    expect(screen.getByText("No pipeline steps ran")).toBeVisible();
    expect(
      screen.queryByRole("region", { name: /enqueue diagnostics/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Request snapshot" }),
    ).not.toBeInTheDocument();
  });

  it("renders enqueue diagnostics for a failed enqueue", () => {
    renderView(
      buildViewModel({
        enqueueStatus: "failed",
        enqueueErrors: [
          { message: "ENQUEUE_BOOM", timestamp: "2026-09-28T10:00:01.000Z" },
        ],
      }),
    );

    const region = screen.getByRole("region", { name: /enqueue diagnostics/i });

    expect(within(region).getByText("ENQUEUE_BOOM")).toBeVisible();
  });

  it("renders the request snapshot and metadata hints when present", () => {
    renderView(
      buildViewModel({
        requestSnapshotJson: '{\n  "method": "POST"\n}',
        metadataHints: ["Request id: req-9"],
      }),
    );

    const snapshot = screen.getByRole("region", { name: "Request snapshot" });

    expect(within(snapshot).getByText(/"method": "POST"/)).toBeVisible();
    expect(snapshot).toHaveClass("max-h-[32rem]");
    expect(
      screen.getByRole("button", { name: "Copy request snapshot" }),
    ).toBeVisible();
    expect(screen.getByText("Request id: req-9")).toBeVisible();
  });

  it("renders run parameters when present", () => {
    renderView(buildViewModel({ runParamsJson: '{\n  "itemId": "abc"\n}' }));

    const runParameters = screen.getByRole("region", {
      name: "Run parameters",
    });

    expect(within(runParameters).getByText(/"itemId": "abc"/)).toBeVisible();
  });

  it("passes invocation rows and the payload scope to the invocations table", () => {
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

    renderView(buildViewModel({ invocations }));

    expect(invocationsTablePropsMock).toHaveBeenCalledWith({
      invocations,
      payloadSource: {
        kind: "schedule",
        parentId: "sched-1",
        executionId: "exec-123",
      },
    });
  });

  it("publishes the parent name for the breadcrumbs", () => {
    render(
      <BreadcrumbEntityLabelsProvider>
        <TooltipProvider>
          <ExecutionDetailView viewModel={buildViewModel()} />
        </TooltipProvider>
        <BreadcrumbLabelProbe />
      </BreadcrumbEntityLabelsProvider>,
    );

    expect(screen.getByTestId("breadcrumb-labels")).toHaveTextContent(
      '{"sched-1":"Morning run"}',
    );
  });
});
