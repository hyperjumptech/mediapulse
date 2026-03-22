/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ScheduleExecutionDetail } from "@/lib/schedules";

import {
  isSensitiveJsonKey,
  maskScheduleExecutionDetailForDisplay,
  maskSecretsInJson,
} from "./mask-json-secrets";

describe("isSensitiveJsonKey", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("treats common credential key names as sensitive", () => {
    // Assert
    expect(isSensitiveJsonKey("password")).toBe(true);
    expect(isSensitiveJsonKey("apiKey")).toBe(true);
    expect(isSensitiveJsonKey("client_secret")).toBe(true);
    expect(isSensitiveJsonKey("access_token")).toBe(true);
    expect(isSensitiveJsonKey("authorization")).toBe(true);
  });

  it("does not flag unrelated keys", () => {
    // Assert
    expect(isSensitiveJsonKey("title")).toBe(false);
    expect(isSensitiveJsonKey("tickerId")).toBe(false);
  });
});

describe("maskSecretsInJson", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("masks nested sensitive string values", () => {
    // Setup
    const input = {
      title: "ok",
      config: { apiKey: "super-secret", nested: { token: "x" } },
    };

    // Act
    const out = maskSecretsInJson(input) as Record<string, unknown>;

    // Assert
    expect(out.title).toBe("ok");
    expect((out.config as Record<string, unknown>).apiKey).toBe("••••••••");
    expect(
      (
        (out.config as Record<string, unknown>).nested as Record<
          string,
          unknown
        >
      ).token,
    ).toBe("••••••••");
  });

  it("passes through plain structures with no sensitive keys", () => {
    // Act
    const out = maskSecretsInJson({ a: 1, b: ["x"] });

    // Assert
    expect(out).toEqual({ a: 1, b: ["x"] });
  });
});

describe("maskScheduleExecutionDetailForDisplay", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("masks params and invocationConfig on each invocation", () => {
    // Setup
    const detail = {
      execution: {
        id: "e1",
        executionTime: new Date(),
        enqueueStatus: "ok",
        runStatus: "ok",
        effectiveExecutionConfig: null,
        jobsCreated: 1,
        jobsEnqueued: 1,
        succeededInvocationCount: 0,
        failedInvocationCount: 1,
        errors: null,
        createdAt: new Date(),
      },
      pipeline: null,
      schedule: { id: "s1", name: "S" },
      stepExecutions: [],
      invocations: [
        {
          jobId: "j1",
          status: "failed",
          agentId: "a",
          pipelineStepId: null,
          params: { apiKey: "x" },
          invocationConfig: { token: "y" },
          error: null,
          agentResponse: null,
          semanticStatus: null,
          startedAt: null,
          completedAt: null,
          dataQueueAttempts: null,
          dataQueueMaxAttempts: null,
        },
      ],
    } satisfies ScheduleExecutionDetail;

    // Act
    const masked = maskScheduleExecutionDetailForDisplay(detail);

    // Assert
    expect(
      (masked.invocations[0]?.params as Record<string, unknown>).apiKey,
    ).toBe("••••••••");
    expect(
      (masked.invocations[0]?.invocationConfig as Record<string, unknown>)
        .token,
    ).toBe("••••••••");
  });
});
