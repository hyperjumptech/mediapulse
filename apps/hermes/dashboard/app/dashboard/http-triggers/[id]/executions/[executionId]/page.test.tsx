import React from "react";
import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@workspace/ui/components/tooltip";

import type { ScheduleExecutionInvocationsTableProps } from "@/components/schedule-execution-invocations-table";
import type { HttpTriggerExecutionSummary } from "@/lib/http-triggers";

const getHttpTriggerExecutionSummaryMock = vi.fn();
const notFoundMock = vi.fn();
const invocationsTablePropsMock = vi.fn();

vi.mock("next/navigation", () => ({
  notFound: () => notFoundMock(),
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("@/lib/http-triggers", () => ({
  getHttpTriggerExecutionSummary: (...args: unknown[]) =>
    getHttpTriggerExecutionSummaryMock(...args),
}));

vi.mock("@/lib/require-dashboard-admin", () => ({
  withDashboardAdmin: <Value,>(load: Promise<Value>) => load,
  requireDashboardAdmin: async () => ({
    id: "u1",
    name: "U",
    email: "u@example.com",
    credentialVersion: 0,
  }),
}));

vi.mock("@/lib/mask-json-secrets", () => ({
  maskExecutionSummaryForDisplay: (summary: unknown) => summary,
  maskSecretsInJson: (value: unknown) => value,
}));

vi.mock("@/lib/compute-execution-elapsed", () => ({
  computePipelineWallElapsed: vi
    .fn()
    .mockReturnValue({ kind: "unknown" as const }),
  formatPipelineElapsedLabel: vi.fn().mockReturnValue("—"),
}));

vi.mock(
  "@/components/execution-detail/execution-invocations-table-section",
  () => ({
    ExecutionInvocationsTableSection: (
      props: ScheduleExecutionInvocationsTableProps,
    ) => {
      invocationsTablePropsMock(props);

      return <div data-testid="invocations-stub">Invocations</div>;
    },
  }),
);

import HttpTriggerExecutionDetailPage from "./page";

const ROUTE_ENQUEUE_ERROR_MESSAGE = "HTTP_TRIGGER_ROUTE_ENQUEUE_FAIL";

const minimalFailedSummary = (): HttpTriggerExecutionSummary => ({
  execution: {
    id: "exec-http-1",
    executionTime: new Date("2026-04-21T12:00:00.000Z"),
    enqueueStatus: "failed",
    runStatus: "pending",
    effectiveExecutionConfig: null,
    jobsCreated: 0,
    jobsEnqueued: 0,
    succeededInvocationCount: 0,
    failedInvocationCount: 0,
    errors: [
      {
        message: ROUTE_ENQUEUE_ERROR_MESSAGE,
        timestamp: "2026-04-21T12:00:01.000Z",
      },
    ],
    metadata: null,
    createdAt: new Date("2026-04-21T12:00:00.000Z"),
  },
  pipeline: { id: "pipe-1", name: "P" },
  trigger: { id: "trig-1", name: "Test trigger" },
  stepExecutions: [],
  invocations: [],
});

const renderPage = async () => {
  const ui = await HttpTriggerExecutionDetailPage({
    params: Promise.resolve({
      id: "trig-1",
      executionId: "exec-http-1",
    }),
  });

  return render(ui, { wrapper: TooltipProvider });
};

describe("HttpTriggerExecutionDetailPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    getHttpTriggerExecutionSummaryMock.mockReset();
    notFoundMock.mockReset();
    invocationsTablePropsMock.mockReset();
  });

  it("renders enqueue diagnostics region with persisted errors for failed enqueue", async () => {
    getHttpTriggerExecutionSummaryMock.mockResolvedValue(
      minimalFailedSummary(),
    );

    await renderPage();

    const region = await screen.findByRole("region", {
      name: /enqueue diagnostics/i,
    });
    const enqueueStatusCard = screen
      .getByText("Enqueue status", { selector: "dt span" })
      .closest("[data-slot='card']");

    expect(within(region).getByText(ROUTE_ENQUEUE_ERROR_MESSAGE)).toBeVisible();
    expect(enqueueStatusCard).toHaveTextContent("failed");
    expect(screen.getByText("Invocation transport")).toBeInTheDocument();
    expect(screen.getByText("Hermes worker + DataQueue")).toBeInTheDocument();
  });

  it("renders the trigger name, pipeline link and no processed URLs action", async () => {
    getHttpTriggerExecutionSummaryMock.mockResolvedValue(
      minimalFailedSummary(),
    );

    await renderPage();

    expect(screen.getByText(/Test trigger/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "P" })).toHaveAttribute(
      "href",
      "/dashboard/pipelines/pipe-1",
    );
    expect(screen.getByRole("button", { name: "Cancel run" })).toBeVisible();
    expect(
      screen.queryByRole("link", { name: "Processed URLs" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Back to HTTP trigger/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Request snapshot" }),
    ).not.toBeInTheDocument();
  });

  it("renders the stored request snapshot when metadata exists", async () => {
    const summary = minimalFailedSummary();
    summary.execution.metadata = { method: "POST", path: "/hooks/run" };
    getHttpTriggerExecutionSummaryMock.mockResolvedValue(summary);

    await renderPage();

    const snapshot = screen.getByRole("region", { name: "Request snapshot" });

    expect(within(snapshot).getByText(/"path": "\/hooks\/run"/)).toBeVisible();
  });

  it("passes scalar invocation rows and the httpTrigger payload scope to the table", async () => {
    getHttpTriggerExecutionSummaryMock.mockResolvedValue({
      ...minimalFailedSummary(),
      invocations: [
        {
          jobId: "job-1",
          status: "completed",
          semanticStatus: "success",
          agentId: "agent-a",
          outcomeSummary: null,
          enqueuedAt: new Date("2026-04-21T12:00:00.000Z"),
          startedAt: new Date("2026-04-21T12:00:01.000Z"),
          completedAt: new Date("2026-04-21T12:00:04.000Z"),
          dataQueueAttempts: null,
          dataQueueMaxAttempts: null,
        },
      ],
    } satisfies HttpTriggerExecutionSummary);

    await renderPage();

    expect(getHttpTriggerExecutionSummaryMock).toHaveBeenCalledWith(
      "trig-1",
      "exec-http-1",
    );
    expect(invocationsTablePropsMock).toHaveBeenCalledWith({
      invocations: [
        {
          jobId: "job-1",
          status: "completed",
          semanticStatus: "success",
          outcomeSummary: null,
          agentId: "agent-a",
          startedAtIso: "2026-04-21T12:00:01.000Z",
          completedAtIso: "2026-04-21T12:00:04.000Z",
          dataQueueAttempts: null,
          dataQueueMaxAttempts: null,
        },
      ],
      payloadSource: {
        kind: "httpTrigger",
        parentId: "trig-1",
        executionId: "exec-http-1",
      },
    });
  });
});
