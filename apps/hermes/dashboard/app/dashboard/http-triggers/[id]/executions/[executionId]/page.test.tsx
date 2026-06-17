import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { HttpTriggerExecutionDetail } from "@/lib/http-triggers";

const getHttpTriggerExecutionDetailMock = vi.fn();
const notFoundMock = vi.fn();

vi.mock("next/navigation", () => ({
  notFound: () => notFoundMock(),
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("@/lib/http-triggers", () => ({
  getHttpTriggerExecutionDetail: (...args: unknown[]) =>
    getHttpTriggerExecutionDetailMock(...args),
}));

vi.mock("@/lib/mask-json-secrets", () => ({
  maskHttpTriggerExecutionDetailForDisplay: (detail: unknown) => detail,
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

import HttpTriggerExecutionDetailPage from "./page";

const ROUTE_ENQUEUE_ERROR_MESSAGE = "HTTP_TRIGGER_ROUTE_ENQUEUE_FAIL";

const minimalFailedDetail = (): HttpTriggerExecutionDetail => ({
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
  pipeline: null,
  trigger: { id: "trig-1", name: "Test trigger" },
  stepExecutions: [],
  invocations: [],
});

describe("HttpTriggerExecutionDetailPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    getHttpTriggerExecutionDetailMock.mockReset();
    notFoundMock.mockReset();
  });

  it("renders enqueue diagnostics region with persisted errors for failed enqueue", async () => {
    getHttpTriggerExecutionDetailMock.mockResolvedValue(minimalFailedDetail());

    const ui = await HttpTriggerExecutionDetailPage({
      params: Promise.resolve({
        id: "trig-1",
        executionId: "exec-http-1",
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
    expect(screen.getByText(/Hermes worker \+ DataQueue/)).toBeInTheDocument();
  });
});
