import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ManualPipelineExecutionDetail } from "@/lib/pipeline-executions";

const getManualPipelineExecutionDetailMock = vi.fn();
const notFoundMock = vi.fn();

vi.mock("next/navigation", () => ({
  notFound: () => notFoundMock(),
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("@/lib/pipeline-executions", () => ({
  getManualPipelineExecutionDetail: (...args: unknown[]) =>
    getManualPipelineExecutionDetailMock(...args),
}));

vi.mock("@/lib/mask-json-secrets", () => ({
  maskManualPipelineExecutionDetailForDisplay: (detail: unknown) => detail,
  maskSecretsInJson: (value: unknown) => value,
}));

vi.mock("@/lib/compute-execution-elapsed", () => ({
  computePipelineWallElapsed: vi
    .fn()
    .mockReturnValue({ kind: "unknown" as const }),
  formatPipelineElapsedLabel: vi.fn().mockReturnValue("—"),
}));

vi.mock("@/lib/format-invocation-outcome-summary", () => ({
  formatInvocationOutcomeSummary: vi.fn().mockReturnValue(null),
}));

vi.mock("@/components/schedule-execution-invocations-table", () => ({
  ScheduleExecutionInvocationsTable: () => (
    <div data-testid="invocations-stub">Invocations</div>
  ),
}));

import PipelineExecutionDetailPage from "./page";

const ROUTE_ENQUEUE_ERROR_MESSAGE = "MANUAL_PIPELINE_ROUTE_ENQUEUE_FAIL";

const minimalFailedDetail = (): ManualPipelineExecutionDetail => ({
  execution: {
    id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
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
  pipeline: { id: "pipe-1", name: "Test pipeline" },
  stepExecutions: [],
  invocations: [],
});

describe("PipelineExecutionDetailPage (manual execution)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    getManualPipelineExecutionDetailMock.mockReset();
    notFoundMock.mockReset();
  });

  it("renders enqueue diagnostics region with persisted errors for failed enqueue", async () => {
    getManualPipelineExecutionDetailMock.mockResolvedValue(
      minimalFailedDetail(),
    );

    const ui = await PipelineExecutionDetailPage({
      params: Promise.resolve({
        id: "pipe-1",
        executionId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      }),
    });
    render(ui as React.ReactElement);

    expect(
      await screen.findByRole("region", { name: /enqueue diagnostics/i }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(ROUTE_ENQUEUE_ERROR_MESSAGE),
    ).toBeInTheDocument();
    expect(screen.getByText(/Enqueue status:/)).toBeInTheDocument();
    expect(screen.getByText("failed")).toBeInTheDocument();
    expect(screen.getByText(/Invocation transport:/)).toBeInTheDocument();
    expect(screen.getByText(/Dashboard HTTP/)).toBeInTheDocument();
  });
});
