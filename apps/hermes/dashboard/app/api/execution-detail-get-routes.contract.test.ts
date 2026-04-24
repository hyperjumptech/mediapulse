/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth-dashboard", () => ({
  getDashboardSession: vi.fn(),
}));

vi.mock("@/lib/schedules", () => ({
  getScheduleExecutionDetail: vi.fn(),
}));

vi.mock("@/lib/http-triggers", () => ({
  getHttpTriggerExecutionDetail: vi.fn(),
}));

vi.mock("@/lib/pipeline-executions", () => ({
  getManualPipelineExecutionDetail: vi.fn(),
}));

import { GET as getHttpTriggerExecutionDetailRoute } from "@/app/api/http-triggers/[triggerId]/executions/[executionId]/route";
import { GET as getManualPipelineExecutionDetailRoute } from "@/app/api/pipelines/[pipelineId]/executions/[executionId]/route";
import { GET as getScheduleExecutionDetailRoute } from "@/app/api/schedules/[scheduleId]/executions/[executionId]/route";
import { getDashboardSession } from "@/lib/auth-dashboard";
import { parseExecutionDetailApiPayload } from "@/lib/execution-detail-api-json-schema";
import { SECRET_MASK } from "@/lib/mask-json-secrets";
import { getHttpTriggerExecutionDetail } from "@/lib/http-triggers";
import { getManualPipelineExecutionDetail } from "@/lib/pipeline-executions";
import { getScheduleExecutionDetail } from "@/lib/schedules";

const scheduleDetailFixture = {
  execution: {
    id: "exec-sched",
    executionTime: new Date("2026-01-01T00:00:00.000Z"),
    enqueueStatus: "success",
    runStatus: "completed",
    effectiveExecutionConfig: null,
    jobsCreated: 0,
    jobsEnqueued: 0,
    succeededInvocationCount: 0,
    failedInvocationCount: 0,
    errors: null,
    metadata: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
  },
  pipeline: null,
  schedule: { id: "sched-1", name: "S" },
  stepExecutions: [],
  invocations: [],
} as const;

const httpTriggerDetailFixture = {
  execution: {
    id: "exec-http",
    executionTime: new Date("2026-01-01T00:00:00.000Z"),
    enqueueStatus: "success",
    runStatus: "completed",
    effectiveExecutionConfig: null,
    jobsCreated: 0,
    jobsEnqueued: 0,
    succeededInvocationCount: 0,
    failedInvocationCount: 0,
    errors: [{ message: "noop", timestamp: "2026-01-01T00:00:00.000Z" }],
    metadata: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
  },
  pipeline: { id: "pipe-1", name: "P" },
  trigger: { id: "trig-1", name: "T" },
  stepExecutions: [],
  invocations: [],
} as const;

const manualPipelineDetailFixture = {
  execution: {
    id: "exec-manual",
    executionTime: new Date("2026-01-01T00:00:00.000Z"),
    enqueueStatus: "failed",
    runStatus: "failed",
    effectiveExecutionConfig: null,
    jobsCreated: 0,
    jobsEnqueued: 0,
    succeededInvocationCount: 0,
    failedInvocationCount: 0,
    errors: [
      {
        message: "planning blocked",
        timestamp: "2026-01-01T00:00:00.000Z",
        phase: "planning",
      },
    ],
    metadata: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
  },
  pipeline: { id: "pipe-1", name: "P" },
  stepExecutions: [],
  invocations: [],
} as const;

describe("execution detail GET APIs (contract)", () => {
  afterEach(() => {
    vi.mocked(getDashboardSession).mockReset();
    vi.mocked(getScheduleExecutionDetail).mockReset();
    vi.mocked(getHttpTriggerExecutionDetail).mockReset();
    vi.mocked(getManualPipelineExecutionDetail).mockReset();
  });

  it("schedule execution detail JSON includes execution.errors (null from DB)", async () => {
    vi.mocked(getDashboardSession).mockResolvedValue({ id: "admin" } as never);
    vi.mocked(getScheduleExecutionDetail).mockResolvedValue(
      structuredClone(scheduleDetailFixture) as never,
    );

    const response = await getScheduleExecutionDetailRoute(
      new Request("http://localhost"),
      {
        params: Promise.resolve({
          scheduleId: "sched-1",
          executionId: "exec-sched",
        }),
      },
    );
    expect(response.status).toBe(200);
    const json: unknown = await response.json();
    const parsed = parseExecutionDetailApiPayload(json);
    expect(parsed.execution.errors).toBeNull();
    expect(
      Object.prototype.hasOwnProperty.call(parsed.execution, "errors"),
    ).toBe(true);
  });

  it("HTTP trigger execution detail JSON includes execution.errors", async () => {
    vi.mocked(getDashboardSession).mockResolvedValue({ id: "admin" } as never);
    vi.mocked(getHttpTriggerExecutionDetail).mockResolvedValue(
      structuredClone(httpTriggerDetailFixture) as never,
    );

    const response = await getHttpTriggerExecutionDetailRoute(
      new Request("http://localhost"),
      {
        params: Promise.resolve({
          triggerId: "trig-1",
          executionId: "exec-http",
        }),
      },
    );
    expect(response.status).toBe(200);
    const json: unknown = await response.json();
    const parsed = parseExecutionDetailApiPayload(json);
    expect(Array.isArray(parsed.execution.errors)).toBe(true);
  });

  it("manual pipeline execution detail JSON includes execution.errors", async () => {
    vi.mocked(getDashboardSession).mockResolvedValue({ id: "admin" } as never);
    vi.mocked(getManualPipelineExecutionDetail).mockResolvedValue(
      structuredClone(manualPipelineDetailFixture) as never,
    );

    const response = await getManualPipelineExecutionDetailRoute(
      new Request("http://localhost"),
      {
        params: Promise.resolve({
          pipelineId: "pipe-1",
          executionId: "exec-manual",
        }),
      },
    );
    expect(response.status).toBe(200);
    const json: unknown = await response.json();
    const parsed = parseExecutionDetailApiPayload(json);
    expect(parsed.execution.errors).toEqual(
      manualPipelineDetailFixture.execution.errors,
    );
  });

  it("schedule execution detail JSON masks sensitive keys inside execution.errors", async () => {
    const fixtureWithSecret = {
      ...scheduleDetailFixture,
      execution: {
        ...scheduleDetailFixture.execution,
        enqueueStatus: "failed",
        errors: [
          {
            message: "enqueue failed",
            timestamp: "2026-01-01T00:00:00.000Z",
            exception: { detail: { apiKey: "must-not-leak-api-key" } },
          },
        ],
      },
    };

    vi.mocked(getDashboardSession).mockResolvedValue({ id: "admin" } as never);
    vi.mocked(getScheduleExecutionDetail).mockResolvedValue(
      structuredClone(fixtureWithSecret) as never,
    );

    const response = await getScheduleExecutionDetailRoute(
      new Request("http://localhost"),
      {
        params: Promise.resolve({
          scheduleId: "sched-1",
          executionId: "exec-sched",
        }),
      },
    );
    expect(response.status).toBe(200);
    const json: unknown = await response.json();
    parseExecutionDetailApiPayload(json);
    const jsonStr = JSON.stringify(json);
    expect(jsonStr).not.toContain("must-not-leak-api-key");
    expect(jsonStr).toContain(SECRET_MASK);
  });
});
