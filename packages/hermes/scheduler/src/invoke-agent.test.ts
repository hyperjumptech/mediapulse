/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";

import {
  applyHermesInvokeCorrelationHeaders,
  invokeAgentPost,
} from "./invoke-agent";

describe("applyHermesInvokeCorrelationHeaders", () => {
  it("adds X-Schedule-Id, X-Schedule-Execution-Id, X-Pipeline-Step-Id when options are non-empty after trim", () => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    applyHermesInvokeCorrelationHeaders(headers, {
      scheduleId: "  sched-1  ",
      scheduleExecutionId: "se-1",
      pipelineStepId: "step-1",
    });
    expect(headers).toMatchObject({
      "X-Schedule-Id": "sched-1",
      "X-Schedule-Execution-Id": "se-1",
      "X-Pipeline-Step-Id": "step-1",
    });
  });

  it("omits headers when values are missing or whitespace-only", () => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    applyHermesInvokeCorrelationHeaders(headers, {
      scheduleId: "   ",
      scheduleExecutionId: undefined,
      pipelineStepId: "",
    });
    expect(headers["X-Schedule-Id"]).toBeUndefined();
    expect(headers["X-Schedule-Execution-Id"]).toBeUndefined();
    expect(headers["X-Pipeline-Step-Id"]).toBeUndefined();
  });

  it("adds X-Manual-Execution-Id when manualExecutionId is set", () => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    applyHermesInvokeCorrelationHeaders(headers, {
      manualExecutionId: "  manual-exec-1  ",
      pipelineStepId: "step-1",
    });
    expect(headers["X-Manual-Execution-Id"]).toBe("manual-exec-1");
    expect(headers["X-Schedule-Id"]).toBeUndefined();
  });
});

describe("invokeAgentPost", () => {
  it("sends correlation headers and JSON body via http client", async () => {
    const post = vi.fn().mockResolvedValue({
      statusCode: 200,
      rawBody: "{}",
      isEmptyBody: false,
    });

    const result = await invokeAgentPost(
      { url: "https://agent.example/run", method: "POST" },
      { input: { x: 1 }, config: {} },
      {
        jobId: "job-1",
        executionId: "exec-1",
        scheduleId: "sched-1",
        scheduleExecutionId: "se-1",
        pipelineStepId: "ps-1",
        authToken: "jwt",
        timeoutMs: 5000,
      },
      { post },
    );

    expect(result.kind).toBe("http");
    expect(post).toHaveBeenCalledWith("https://agent.example/run", {
      json: { input: { x: 1 }, config: {} },
      headers: {
        "Content-Type": "application/json",
        "X-Job-Id": "job-1",
        "X-Execution-Id": "exec-1",
        "X-Schedule-Id": "sched-1",
        "X-Schedule-Execution-Id": "se-1",
        "X-Pipeline-Step-Id": "ps-1",
        Authorization: "Bearer jwt",
      },
      timeout: { request: 5000 },
      signal: undefined,
    });
  });
});
